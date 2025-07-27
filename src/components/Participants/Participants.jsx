import React, { useState, useEffect } from 'react';
import styles from './Participants.module.css';

function Participants({ socket, userRole }) {
  const [participants, setParticipants] = useState([]);

  useEffect(() => {
    if (!socket) {
      console.log('Participants: Socket not available.');
      return;
    }

    const handleUpdateClientList = (clientList) => {
      console.log('Participants: Received clientList update:', JSON.stringify(clientList, null, 2)); // Log full data
      setParticipants(clientList);
    };

    socket.on('updateClientList', handleUpdateClientList);

    console.log('Participants: Component mounted/socket changed. userRole:', userRole);

    return () => {
      socket.off('updateClientList', handleUpdateClientList);
    };
  }, [socket, userRole]);

  const handleKickStudent = (studentSocketId) => {
    console.log('Participants: Attempting to kick student:', studentSocketId, 'from userRole:', userRole);
    if (socket && userRole === 'teacher' && confirm('Are you sure you want to kick this student?')) {
      socket.emit('kickStudent', studentSocketId);
      console.log('Participants: Emitted kickStudent for:', studentSocketId);
    } else if (userRole !== 'teacher') {
      console.log('Participants: Not authorized to kick (not a teacher).');
    }
  };

  return (
    <div className={styles.participantsContainer}>
      <h3>Participants ({participants.length})</h3>
      <ul className={styles.participantsList}>
        {participants.map((client) => (
          <li key={client.socketId} className={styles.participantItem}>
            <span className={styles.participantName}>{client.name || 'Anonymous'}</span>
            <span className={styles.participantRole}>({client.role})</span>
            {userRole === 'teacher' && client.role === 'student' && (
              <button
                className={styles.kickButton}
                onClick={() => handleKickStudent(client.socketId)}
              >
                Kick
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Participants; 