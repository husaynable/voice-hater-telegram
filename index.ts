import { Client } from 'tdl';
import { TDLib } from 'tdl-tdlib-addon';
require('dotenv').config();

const client = new Client(new TDLib(), {
  apiId: +process.env.API_ID,
  apiHash: process.env.API_HASH,
});

client.on('error', console.error);

async function main () {
  await client.connectAndLogin()
  const me = await client.invoke({ _: 'getMe' });
  client.on('update', async (update) => {
    if (update._ === 'updateNewMessage') {
      console.log(update.message);

      if (update.message.content._ === 'messageVoiceNote' && update.message.sender_id._ === 'messageSenderUser'){
        const chat = await client.invoke({
          _: 'getChat',
          chat_id: update.message.chat_id
        });

        if (chat.type._ === 'chatTypePrivate') {
          await removeMessageAndSendWarning(update.message.chat_id, update.message.id, update.message.can_be_deleted_for_all_users);
          return;
        }

        if (update.message.reply_to_message_id) {
          const repliedMessage = await client.invoke({
            _: 'getMessage',
            message_id: update.message.reply_to_message_id,
            chat_id: update.message.reply_in_chat_id
          });
          if (repliedMessage.sender_id._ === 'messageSenderUser' && repliedMessage.sender_id.user_id === me.id) {
            await removeMessageAndSendWarning(update.message.chat_id, update.message.id, update.message.can_be_deleted_for_all_users);
            return;
          }
        }
      }
    }
  });
}

main();

async function wait(ms?: number): Promise<void> {
  return new Promise((res) => {
    setTimeout(() => res(), ms ?? 3000);
  });
}

async function removeMessageAndSendWarning(chat_id: number, message_id: number, canRemoveMessage: boolean): Promise<void> {
  if (canRemoveMessage) {
    await wait(1000);
    await client.invoke({
      _: 'deleteMessages',
      chat_id: chat_id,
      message_ids: [message_id],
    });
  }

  await wait();
  await client.invoke({
    _: 'sendMessage',
    chat_id: chat_id,
    input_message_content: {
      _: 'inputMessageText',
      text: {
        _: 'formattedText',
        text: 'не делай так больше...'
      }
    }
  });
}