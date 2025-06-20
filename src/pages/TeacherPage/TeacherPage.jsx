import { useState, useEffect, useRef } from 'react';
import styles from './TeacherPage.module.css';
import { io } from 'socket.io-client';

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
  
  // Server-driven states
  const [currentPoll, setCurrentPoll] = useState(null);
  const [pollResults, setPollResults] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [studentsAnswered, setStudentsAnswered] = useState(0);
  const [pollHistory, setPollHistory] = useState([]);

  const pollActive = !!currentPoll; // Determine if a poll is active based on server data

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io(SOCKET_SERVER_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to backend Socket.io server (Teacher)', newSocket.id);
      newSocket.emit('registerClient', { role: 'teacher' });
      newSocket.emit('requestPollHistory'); // Request history on connect
    });

    newSocket.on('initialPollState', (state) => {
      setCurrentPoll(state.currentPoll);
      setPollResults(state.pollResults);
      setTimeLeft(state.timeLeft);
      setTotalStudents(state.totalStudents);
      setStudentsAnswered(state.studentsAnswered);
      // pollHistory is sent with initial state
      if (state.pollHistory) {
        setPollHistory(state.pollHistory);
      }
    });

    newSocket.on('pollStateUpdate', (state) => {
      setCurrentPoll(state.currentPoll);
      setPollResults(state.pollResults);
      setTimeLeft(state.timeLeft);
      setTotalStudents(state.totalStudents);
      setStudentsAnswered(state.studentsAnswered);
    });

    newSocket.on('newPoll', (poll) => {
      setCurrentPoll(poll);
      setPollResults(poll.options.reduce((acc, opt) => { acc[opt.id] = 0; return acc; }, {}));
      setTimeLeft(poll.duration);
      setStudentsAnswered(0); // Reset for new poll
    });

    newSocket.on('pollEnded', ({ finalResults, pollId }) => {
      console.log(`Poll ${pollId} ended with final results:`, finalResults);
      setPollHistory(prevHistory => {
        const updatedHistory = prevHistory.map(poll => 
          poll.id === pollId ? { ...poll, results: finalResults } : poll
        );
        if (!updatedHistory.some(poll => poll.id === pollId) && currentPoll && currentPoll.id === pollId) {
          updatedHistory.push({ ...currentPoll, results: finalResults, timestamp: Date.now() });
        }
        return updatedHistory;
      });
      setCurrentPoll(null);
      setPollResults({});
      setTimeLeft(0);
      setStudentsAnswered(0);
      setQuestion(''); // Clear form for next poll
      setOptions([
        { text: '', isCorrect: null },
        { text: '', isCorrect: null },
      ]);
      setDuration(60);
    });

    newSocket.on('pollHistoryUpdate', (history) => {
      setPollHistory(history);
    });

    newSocket.on('error', (message) => {
      alert(`Server Error: ${message}`);
      console.error('Server Error:', message);
    });

    return () => {
      newSocket.off('connect');
      newSocket.off('initialPollState');
      newSocket.off('pollStateUpdate');
      newSocket.off('newPoll');
      newSocket.off('pollEnded');
      newSocket.off('pollHistoryUpdate');
      newSocket.off('error');
      newSocket.disconnect();
      console.log('Disconnected from backend Socket.io server (Teacher)');
    };
  }, []);

  const handleOptionChange = (idx, value) => {
    const newOptions = [...options];
    newOptions[idx].text = value;
    setOptions(newOptions);
  };

  const handleCorrectChange = (idx, isCorrect) => {
    const newOptions = [...options];
    newOptions[idx].isCorrect = isCorrect;
    setOptions(newOptions);
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
    options.some(opt => opt.isCorrect !== null);

  const handleAskQuestion = () => {
    if (!socket) return;
    socket.emit('createPoll', {
      question,
      options,
      duration,
    });
    // Form will be reset by initialPollState or pollStateUpdate from server (or pollEnded for history)
  };

  const handleEndPoll = () => {
    if (!socket || !currentPoll) return;
    socket.emit('endPoll');
  };

  const getPercentage = (optionId) => {
    const totalVotes = Object.values(pollResults).reduce((sum, count) => sum + count, 0);
    const votesForOption = pollResults[optionId] || 0;
    return totalVotes === 0 ? 0 : Math.round((votesForOption / totalVotes) * 100);
  };

  const allStudentsAnswered = totalStudents > 0 && studentsAnswered === totalStudents;

  return (
    <div className={styles.wrapper}>
      <div className={styles.dashboard}>
        <div className={styles.headerRow}>
          <span className={styles.badge}>Intervue Poll</span>
        </div>
        <h1 className={styles.bigTitle}>Teacher Dashboard</h1>
        <p className={styles.subtitle}>
          Create polls, view live results, and manage the classroom in real-time.
        </p>

        {/* Conditional rendering based on pollActive status from server */}
        {!pollActive ? (
          <> {/* Poll Creation Form */}
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
            </div>

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
              <button className={styles.addOptionBtn} onClick={addOption}>
                + Add More option
              </button>
            </div>

            <div className={styles.footerRow}>
              <button
                className={styles.askBtn}
                onClick={handleAskQuestion}
                disabled={!canAsk}
              >
                Ask Question
              </button>
            </div>
          </>
        ) : (
          <> {/* Live Poll Results Display */}
            <div className={styles.livePollDisplay}>
              <h2>Live Poll Results</h2>
              <p className={styles.liveQuestion}><strong>Question:</strong> {currentPoll.question}</p>
              <div className={styles.liveResultsSummary}>
                <span>Time Left: {timeLeft < 10 ? `0${timeLeft}` : timeLeft}s</span>
                <span>Students Answered: {studentsAnswered} / {totalStudents}</span>
                {allStudentsAnswered && (
                  <span className={styles.allAnsweredMsg}>All students answered!</span>
                )}
              </div>
              <div className={styles.resultsDisplay}>
                {currentPoll.options.map((option) => (
                  <div key={option.id} className={styles.resultBarContainer}>
                    <span className={styles.resultOptionText}>{option.text}</span>
                    <div className={styles.progressBarWrapper}>
                      <div
                        className={styles.progressBar}
                        style={{ width: `${getPercentage(option.id)}%` }}
                      ></div>
                      <span className={styles.percentage}>{getPercentage(option.id)}%</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className={styles.footerRow}>
                <button onClick={handleEndPoll} className={styles.endPollBtn}>
                  End Poll
                </button>
              </div>
            </div>
          </>
        )}

        {/* Poll History Display (separate from active poll) */}
        {pollHistory.length > 0 && (
          <div className={styles.historySection}>
            <h2 className={styles.historyTitle}>Poll History</h2>
            {pollHistory.map((poll) => (
              <div key={poll.id} className={styles.historyPollCard}>
                <p className={styles.historyQuestion}><strong>Q:</strong> {poll.question}</p>
                <ul className={styles.historyOptionsList}>
                  {poll.options.map((option, idx) => (
                    <li key={idx} className={styles.historyOptionItem}>
                      {option.text} ({option.isCorrect === true ? 'Correct' : option.isCorrect === false ? 'Incorrect' : 'N/A'})
                      <span>: {poll.results[option.id] || 0} votes</span>
                    </li>
                  ))}
                </ul>
                <p className={styles.historyMeta}>Duration: {poll.duration} seconds | Asked: {new Date(poll.timestamp).toLocaleTimeString()}</p>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

export default TeacherPage; 