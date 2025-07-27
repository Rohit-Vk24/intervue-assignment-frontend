import { useState, useEffect } from 'react';
import styles from './TeacherPage.module.css';
import { io } from 'socket.io-client';
import Chat from '../../components/Chat/Chat';
import Participants from '../../components/Participants/Participants';

const DURATION_OPTIONS = [30, 45, 60, 90, 120];
const MAX_QUESTION_LENGTH = 100;
const SOCKET_SERVER_URL = 'http://localhost:3001';

function TeacherPage() {
  const [socket, setSocket] = useState(null);
  const [question, setQuestion] = useState('');
  const [duration, setDuration] = useState(60);
  const [options, setOptions] = useState([
    { text: '', isCorrect: null },
    { text: '', isCorrect: null },
  ]);
  const [currentPoll, setCurrentPoll] = useState(null); // To show if a poll is active
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(0); // New state for countdown timer
  const [lastPollResults, setLastPollResults] = useState(null); // State for storing results of the last poll
  const [endedPollDetails, setEndedPollDetails] = useState(null); // State to store details of the poll that just ended
  const [showSidePanel, setShowSidePanel] = useState(true); // State to control visibility of side panel
  const [activeSidePanelTab, setActiveSidePanelTab] = useState('participants'); // 'chat' or 'participants'

  useEffect(() => {
    console.log('TeacherPage: Initializing socket connection and listeners.');
    const newSocket = io(SOCKET_SERVER_URL, {
      transports: ['websocket', 'polling'],
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to backend Socket.io server (Teacher)', newSocket.id);
      newSocket.emit('registerClient', { role: 'teacher' });
    });

    newSocket.on('newPoll', (poll) => {
      console.log('Teacher: Received newPoll event.', poll);
      setCurrentPoll(poll);
      setQuestion(poll.question);
      setOptions(poll.options.map(opt => ({ id: opt.id, text: opt.text, isCorrect: opt.isCorrect }))); // Ensure id is passed
      setDuration(poll.duration);
      setError(''); // Clear any previous errors on new poll
      setLastPollResults(null); // Clear previous results when a new poll starts
      setEndedPollDetails(null); // Clear ended poll details for new poll

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
      console.log('Teacher: pollEnded received:', { pollId, results, question, options });
      setCurrentPoll(null);
      setQuestion('');
      setOptions([
        { text: '', isCorrect: null },
        { text: '', isCorrect: null },
      ]);
      setDuration(60);
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
      console.log('Disconnected from backend Socket.io server (Teacher)', reason);
      setCurrentPoll(null); // Clear poll on disconnect
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleOptionChange = (idx, value) => {
    const newOptions = [...options];
    newOptions[idx].text = value;
    setOptions(newOptions);
  };

  const handleCorrectChange = (idx, isCorrect) => {
    const newOptions = [...options];
    // Ensure only one option can be correct
    const updatedOptions = newOptions.map((opt, currentIdx) => ({
      ...opt,
      isCorrect: currentIdx === idx ? isCorrect : (isCorrect ? null : opt.isCorrect) // If setting true, others become null
    }));
    setOptions(updatedOptions);
  };

  const addOption = () => setOptions([...options, { text: '', isCorrect: null }]);

  const handleQuestionChange = (e) => {
    if (e.target.value.length <= MAX_QUESTION_LENGTH) {
      setQuestion(e.target.value);
    }
  };

  const canAsk =
    question.trim() &&
    options.length >= 2 &&
    options.every(opt => opt.text.trim()) &&
    options.some(opt => opt.isCorrect === true); // At least one option must be explicitly correct

  const handleAskQuestion = () => {
    if (!socket || !canAsk) return;
    setError(''); // Clear previous errors
    socket.emit('createPoll', {
      question,
      options,
      duration,
    });
    console.log('Teacher: Emitted createPoll event.');
  };

  const handleEndPoll = () => {
    console.log('Teacher: handleEndPoll called.');
    if (socket) {
      socket.emit('endPoll');
      console.log('Teacher: Emitted endPoll event.');
    } else {
      console.log('Teacher: Socket not available to emit endPoll.');
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.dashboard}>
        <span className={styles.badge}>Intervue Poll</span>
        <h1 className={styles.bigTitle}>Teacher Dashboard</h1>
        <p className={styles.subtitle}>
          Create polls for your students.
        </p>

        {error && <p className={styles.errorMessage}>{error}</p>}

        <div className={styles.mainContent}>
          <div className={styles.pollSection}>
            {currentPoll ? (
              <div className={styles.activePollStatus}>
                <h2>Active Poll: "{currentPoll.question}"</h2>
                <p>Poll is active for {timeLeft} seconds.</p>
                <p>Waiting for students to answer...</p>
                <button
                  onClick={handleEndPoll}
                  className={styles.endPollBtn}
                >
                  End Poll
                </button>
              </div>
            ) : (
              <>
                {endedPollDetails ? (
                  <div className={styles.pollResultsDisplay}>
                    <h2>Last Poll Results:</h2>
                    <h3>Question: "{endedPollDetails.question}"</h3>
                    {Array.isArray(endedPollDetails.options) && endedPollDetails.options.length > 0 ? (
                      <ul>
                        {endedPollDetails.options.map(option => (
                          <li key={option.id} className={option.isCorrect ? styles.correctOption : styles.incorrectOption}>
                            {option.text}: {lastPollResults && lastPollResults[option.id] ? lastPollResults[option.id] : 0} votes
                            {option.isCorrect ? ' (Correct)' : ''}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No poll details available to display results.</p>
                    )}
                    <button
                      onClick={() => {
                        setLastPollResults(null);
                        setEndedPollDetails(null); // Clear ended poll details
                        setQuestion(''); // Reset question
                        setOptions([
                          { text: '', isCorrect: null },
                          { text: '', isCorrect: null },
                        ]); // Reset options
                        setDuration(60); // Reset duration
                      }}
                      className={styles.clearResultsBtn}
                    >
                      Clear Results & Create New Poll
                    </button>
                  </div>
                ) : (
                  <div className={styles.formSection}>
                    <div className={styles.formRow}>
                      <label className={styles.label} htmlFor="question">Enter your question</label>
                      <select
                        className={styles.durationSelect}
                        value={duration}
                        onChange={e => setDuration(Number(e.target.value))}
                      >
                        {DURATION_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt} seconds</option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      id="question"
                      className={styles.textarea}
                      placeholder="Type your question here..."
                      value={question}
                      onChange={handleQuestionChange}
                      maxLength={MAX_QUESTION_LENGTH}
                    />
                    <div className={styles.charCount}>{question.length}/{MAX_QUESTION_LENGTH}</div>

                    <div className={styles.optionsSection}>
                      <div className={styles.optionsHeaderRow}>
                        <span className={styles.optionsHeader}>Edit Options</span>
                        <span className={styles.optionsHeader}>Is it Correct?</span>
                      </div>
                      {options.map((opt, idx) => (
                        <div className={styles.optionRow} key={idx}>
                          <input
                            className={styles.optionInput}
                            type="text"
                            placeholder={`Option ${idx + 1}`}
                            value={opt.text}
                            onChange={e => handleOptionChange(idx, e.target.value)}
                            maxLength={50}
                          />
                          <div className={styles.radioGroup}>
                            <label className={styles.radioLabel}>
                              <input
                                type="radio"
                                name={`correct-${idx}`}
                                checked={opt.isCorrect === true}
                                onChange={() => handleCorrectChange(idx, true)}
                              />
                              Yes
                            </label>
                            <label className={styles.radioLabel}>
                              <input
                                type="radio"
                                name={`correct-${idx}`}
                                checked={opt.isCorrect === false}
                                onChange={() => handleCorrectChange(idx, false)}
                              />
                              No
                            </label>
                          </div>
                        </div>
                      ))}
                      <button onClick={addOption} className={styles.addOptionBtn}>+ Add Option</button>
                    </div>
                    <button
                      onClick={handleAskQuestion}
                      className={styles.askQuestionBtn}
                      disabled={!canAsk}
                    >
                      Ask Question
                    </button>
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
                <Chat socket={socket} senderId={socket?.id} senderName="Teacher" senderRole="teacher" />
              </div>
              <div className={`${styles.participantsTabContent} ${activeSidePanelTab === 'participants' ? styles.activeTabContent : styles.hiddenTabContent}`}>
                <Participants socket={socket} userRole="teacher" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TeacherPage; 