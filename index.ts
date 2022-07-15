import { Client } from 'tdl';
import { TDLib } from 'tdl-tdlib-addon';
import {
  message,
  chat,
  MessageSender,
  user,
  textEntity$Input,
} from 'tdlib-types';
require('dotenv').config();

const client = new Client(new TDLib(), {
  apiId: +process.env.API_ID,
  apiHash: process.env.API_HASH,
});

client.on('error', console.error);

async function main() {
  await client.connectAndLogin();
  const me = await client.invoke({ _: 'getMe' });

  client.on('update', async (update) => {
    if (update._ === 'updateNewMessage') {
      const message = update.message;

      await handleNewMessage(message, me);
    }
  });
}

main();

async function handleNewMessage(message: message, me: user): Promise<void> {
  if (isVoiceMessageFromUser(message)) {
    const chat = await getChat(message.chat_id);

    if (isPrivateChat(chat)) {
      await removeMessageAndSendWarning(message);
    } else if (message.reply_to_message_id) {
      const repliedMessage = await getRepliedMessage(
        message.reply_to_message_id,
        message.reply_in_chat_id
      );

      if (isVoiceMessageReplyToMe(repliedMessage.sender_id, me.id)) {
        // @ts-ignore
        const user = await getUserInfo(message.sender_id.user_id)
        await removeMessageAndSendWarning(message, user.username);
      }
    }
  }
}

async function wait(ms?: number): Promise<void> {
  return new Promise((res) => {
    setTimeout(() => res(), ms ?? 3000);
  });
}

async function removeMessageAndSendWarning(
  message: message,
  mentionUsername?: string
): Promise<void> {
  if (message.can_be_deleted_for_all_users) {
    await wait(1000);
    await client.invoke({
      _: 'deleteMessages',
      chat_id: message.chat_id,
      message_ids: [message.id],
      revoke: true,
    });
  }

  await wait();
  await client.invoke({
    _: 'sendMessage',
    chat_id: message.chat_id,
    input_message_content: {
      _: 'inputMessageText',
      text: {
        _: 'formattedText',
        text: getMessageText(mentionUsername),
        entities: getMessageEntities(mentionUsername),
      },
    },
  });
}

function isVoiceMessageFromUser(message: message): boolean {
  return (
    message.content._ === 'messageVoiceNote' &&
    message.sender_id._ === 'messageSenderUser'
  );
}

function getChat(chatId: number): Promise<chat> {
  return client.invoke({
    _: 'getChat',
    chat_id: chatId,
  });
}

function isPrivateChat(chat: chat): boolean {
  return chat.type._ === 'chatTypePrivate';
}

function getRepliedMessage(
  messageId: number,
  chatId: number
): Promise<message> {
  return client.invoke({
    _: 'getMessage',
    message_id: messageId,
    chat_id: chatId,
  });
}

function isVoiceMessageReplyToMe(sender: MessageSender, myId: number): boolean {
  return sender._ === 'messageSenderUser' && sender.user_id === myId;
}

function getMessageText(mentionName?: string): string {
  return `${mentionName ? '@' + mentionName + ', ' : ''}${
    process.env.MESSAGE ?? 'этот пользователь отключил возможность отправки ему голосовых сообщений.'
  }`;
}

function getMessageEntities(
  mentionUsername?: string
): ReadonlyArray<textEntity$Input> {
  const entities: textEntity$Input[] = [
    {
      _: 'textEntity',
      type: { _: 'textEntityTypeItalic' },
      offset: mentionUsername ? mentionUsername.length + 3 : 0,
      length: 72,
    }
  ];

  if (mentionUsername) {
    entities.push(
      {
        _: 'textEntity',
        type: { _: 'textEntityTypeMention' },
        offset: 0,
        length: mentionUsername.length + 1,
      },
    )
  }
  return entities;
}

function getUserInfo(userId: number): Promise<user> {
  return client.invoke({
    _: 'getUser',
    user_id: userId,
  });
}