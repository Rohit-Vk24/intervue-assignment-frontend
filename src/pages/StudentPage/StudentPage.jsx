import { useState, useEffect } from 'react';
import styles from './StudentPage.module.css';
import { io } from 'socket.io-client';
import Chat from '../../components/Chat/Chat';
import Participants from '../../components/Participants/Participants';

const SOCKET_SERVER_URL = 'http://localhost:3001';

function StudentPage() {
  const [socket, setSocket] = useState(null);
  const [studentName, setStudentName] = useState(() => sessionStorage.getItem('studentName') || '');
  const [showNameInput, setShowNameInput] = useState(!sessionStorage.getItem('studentName'));
  const [isRegistered, setIsRegistered] = useState(false);

  const [currentPoll, setCurrentPoll] = useState(null);
  const [selectedOptionId, setSelectedOptionId] = useState(null); // Store ID of selected option
  const [hasAnswered, setHasAnswered] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(0); // New state for countdown timer
  const [lastPollResults, setLastPollResults] = useState(null); // New state for storing results of the last poll
  const [endedPollDetails, setEndedPollDetails] = useState(null); // New state to store details of the poll that just ended
  const [showSidePanel, setShowSidePanel] = useState(true); // State to control visibility of side panel
  const [activeSidePanelTab, setActiveSidePanelTab] = useState('participants'); // 'chat' or 'participants'
  const [isKickedOut, setIsKickedOut] = useState(false); // New state for kick out status

  // Socket connection and event handling
  useEffect(() => {
    const newSocket = io(SOCKET_SERVER_URL, {
      transports: ['websocket', 'polling'],
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to backend Socket.io server (Student)', newSocket.id);
    });

    newSocket.on('newPoll', (poll) => {
      console.log('New poll received:', poll);
      setCurrentPoll(poll);
      setSelectedOptionId(null); // Reset selection for new poll
      setHasAnswered(false);     // Reset answered status for new poll
      setError('');             // Clear any previous errors
      setLastPollResults(null); // Clear previous results on new poll
      setEndedPollDetails(null); // Clear ended poll details on new poll

      // Initialize timer for the new poll
      const endTime = poll.startTime + poll.duration * 1000;
      const interval = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
        setTimeLeft(remaining);
        if (remaining === 0) {
          clearInterval(interval);
        }
      }, 1000);

      return () => clearInterval(interval); // Clean up interval on component unmount or new poll
    });

    newSocket.on('pollEnded', ({ pollId, results, question, options }) => {
      console.log(`Poll ${pollId} ended. Updating student UI.`, { pollId, results, question, options });
      setCurrentPoll(null);
      // Keep selectedOptionId to show what student chose, but set hasAnswered to true to prevent re-answering
      // No, actually, we need to clear selectedOptionId for the next poll
      setHasAnswered(false); // Reset answered status for new poll
      setTimeLeft(0); // Reset timer when poll ends
      setLastPollResults(results); // Store the received results
      setEndedPollDetails({
        id: pollId,
        question: question,
        options: options,
      });
    });

    newSocket.on('error', (message) => {
      setError(`Server Error: ${message}`);
      console.error('Server Error:', message);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Disconnected from backend Socket.io server (Student)', reason);
      setCurrentPoll(null); // Clear poll on disconnect
      setSelectedOptionId(null);
      setHasAnswered(false);
      setIsRegistered(false); // Reset registration status
      // If the reason is not a manual kick (which we handle with 'kickedOut' event)
      // then we might want to show a generic disconnected message.
      // For now, only kickedOut will trigger specific UI
    });

    newSocket.on('kickedOut', ({ message }) => {
      console.log('Student: Kicked out received:', message);
      setIsKickedOut(true);
      // Clear session storage to prevent immediate re-registration on refresh
      sessionStorage.removeItem('studentName');
      newSocket.disconnect(); // Ensure socket is fully disconnected
    });

    return () => {
      newSocket.disconnect();
    };
  }, []); // Empty dependency array to run only once on mount

  // Handle registration when socket and studentName are available
  useEffect(() => {
    if (socket && studentName && !isRegistered) {
      console.log('StudentPage: Attempting to register client with name:', studentName);
      socket.emit('registerClient', { role: 'student', name: studentName });
      setIsRegistered(true);
    }
  }, [socket, studentName, isRegistered]);

  const handleSubmitAnswer = () => {
    if (socket && currentPoll && selectedOptionId !== null && !hasAnswered) {
      setError(''); // Clear previous errors
      socket.emit('submitAnswer', { pollId: currentPoll.id, optionId: selectedOptionId });
      setHasAnswered(true); // Mark as answered locally
      // In a real app, you might optimistically update UI or wait for server confirmation
    } else if (!selectedOptionId) {
      setError('Please select an option before submitting.');
    }
  };

  const handleNameSubmit = (e) => {
    e.preventDefault();
    if (studentName.trim()) {
      sessionStorage.setItem('studentName', studentName.trim());
      setShowNameInput(false);
      // Register client immediately after name is submitted and stored
      if (socket && !isRegistered) {
        socket.emit('registerClient', { role: 'student', name: studentName.trim() });
        setIsRegistered(true);
      }
    } else {
      setError('Please enter your name.');
    }
  };

  if (isKickedOut) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.dashboard} style={{ textAlign: 'center' }}>
          <span className={styles.badge}>Intervue Poll</span>
          <h1 className={styles.bigTitle}>You've been Kicked out !</h1>
          <p className={styles.subtitle}>
            Looks like the teacher had removed you from the poll system. Please
            Try again sometime.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.dashboard}>
        <span className={styles.badge}>Intervue Poll</span>
        <h1 className={styles.bigTitle}>Student Dashboard</h1>
        <p className={styles.subtitle}>
          {currentPoll ? 'Active Poll' : (endedPollDetails ? 'Last Poll Results' : 'Waiting for teacher to start a poll...')}
        </p>

        {error && <p className={styles.errorMessage}>{error}</p>}

        <div className={styles.mainContent}>
          <div className={styles.pollSection}>
            {showNameInput ? (
              <form onSubmit={handleNameSubmit} className={styles.nameInputCard}>
                <h2>Enter Your Name</h2>
                <input
                  type="text"
                  placeholder="Your Name"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  required
                />
                <button type="submit">Start Polling</button>
                {error && <p className={styles.errorMessage}>{error}</p>}
              </form>
            ) : (
              <>
                {currentPoll && !hasAnswered && (
                  <div className={styles.activePoll}>
                    <p className={styles.liveQuestion}><strong>Question:</strong> {currentPoll.question}</p>
                    <div className={styles.optionsGrid}>
                      {currentPoll.options.map((option) => (
                        <button
                          key={option.id}
                          className={`${styles.optionButton} ${selectedOptionId === option.id ? styles.selected : ''}`}
                          onClick={() => setSelectedOptionId(option.id)}
                        >
                          {option.text}
                        </button>
                      ))}
                    </div>
                    <button
                      className={styles.submitBtn}
                      onClick={handleSubmitAnswer}
                      disabled={selectedOptionId === null || hasAnswered}
                    >
                      Submit Answer
                    </button>
                    <p className={styles.statusMessage}>Time remaining: {timeLeft}s</p>
                  </div>
                )}

                {currentPoll && hasAnswered && (
                  <div className={styles.awaitingResults}>
                    <h2>Thank You for Answering!</h2>
                    <p>Waiting for the teacher to end the poll to see results.</p>
                    <p className={styles.statusMessage}>You selected: {currentPoll.options.find(opt => opt.id === selectedOptionId)?.text}</p>
                  </div>
                )}

                {!currentPoll && !showNameInput && endedPollDetails ? (
                  <div className={styles.pollResultsDisplay}>
                    <h2>Last Poll Results:</h2>
                    <h3>Question: "{endedPollDetails.question}"</h3>
                    {Array.isArray(endedPollDetails.options) && endedPollDetails.options.length > 0 ? (
                      <ul>
                        {endedPollDetails.options.map(option => (
                          <li
                            key={option.id}
                            className={`${option.isCorrect ? styles.correctOption : styles.incorrectOption} ${selectedOptionId === option.id ? styles.selectedOptionStudent : ''}`}
                          >
                            {option.text}: {lastPollResults && lastPollResults[option.id] ? lastPollResults[option.id] : 0} votes
                            {option.isCorrect ? ' (Correct)' : ''}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No poll details available to display results.</p>
                    )}
                  </div>
                ) : (
                  // Original waiting state for students when no poll is active and no results to display
                  <div className={styles.waitingState}>
                    <h2>Waiting for teacher...</h2>
                    <p>The teacher will start a new poll shortly.</p>
                  </div>
                )}
              </>
            )}
          </div>

          <div className={styles.sidePanelToggle}>
            <button
              className={`${styles.toggleButton} ${showSidePanel && activeSidePanelTab === 'chat' ? styles.activeTab : ''}`}
              onClick={() => setShowSidePanel(prev => !prev || activeSidePanelTab !== 'chat' ? (setActiveSidePanelTab('chat'), true) : false)}
            >
              Chat
            </button>
            <button
              className={`${styles.toggleButton} ${showSidePanel && activeSidePanelTab === 'participants' ? styles.activeTab : ''}`}
              onClick={() => setShowSidePanel(prev => !prev || activeSidePanelTab !== 'participants' ? (setActiveSidePanelTab('participants'), true) : false)}
            >
              Participants
            </button>
          </div>

          {showSidePanel && (
            <div className={styles.sidePanel}>
              <div className={`${styles.chatTabContent} ${activeSidePanelTab === 'chat' ? styles.activeTabContent : styles.hiddenTabContent}`}>
                <Chat socket={socket} senderId={socket?.id} senderName={studentName || 'Anonymous'} senderRole="student" />
              </div>
              <div className={`${styles.participantsTabContent} ${activeSidePanelTab === 'participants' ? styles.activeTabContent : styles.hiddenTabContent}`}>
                <Participants socket={socket} userRole="student" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default StudentPage;