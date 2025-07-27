import React, { useState, useEffect, useRef } from 'react';
import styles from './Chat.module.css';

function Chat({ socket, senderId, senderName, senderRole }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null); // Ref for scrolling to the latest message

  useEffect(() => {
    if (!socket) {
      console.log('Chat: Socket not available.');
      return;
    }

    const handleReceiveMessage = (message) => {
      console.log('Chat: Received message:', message);
      setMessages((prevMessages) => [...prevMessages, message]);
    };

    socket.on('receiveMessage', handleReceiveMessage);

    return () => {
      socket.off('receiveMessage', handleReceiveMessage);
    };
  }, [socket]);

  useEffect(() => {
    // Scroll to the bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim() && socket) {
      console.log('Chat: Sending message:', newMessage);
      socket.emit('sendMessage', { senderId, senderName, senderRole, message: newMessage });
      setNewMessage('');
    }
  };

  return (
    <div className={styles.chatContainer}>
      <div className={styles.messagesList}>
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`${styles.messageItem} ${msg.senderId === senderId ? styles.myMessage : styles.otherMessage}`}
          >
            <span className={styles.messageSender}>{msg.senderName || msg.senderRole}:</span>
            <span className={styles.messageText}>{msg.message}</span>
            <span className={styles.messageTimestamp}>{new Date(msg.timestamp).toLocaleTimeString()}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSendMessage} className={styles.messageInputForm}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className={styles.messageInputField}
        />
        <button type="submit" className={styles.sendMessageBtn}>Send</button>
      </form>
    </div>
  );
}

export default Chat; 