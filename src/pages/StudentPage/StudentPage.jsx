import { useState, useEffect } from 'react';
import styles from './StudentPage.module.css';
import { io } from 'socket.io-client';

const SOCKET_SERVER_URL = 'http://localhost:3001';

function StudentPage() {
  const [socket, setSocket] = useState(null);
  const [studentName, setStudentName] = useState(() => sessionStorage.getItem('studentName') || '');
  const [showNameInput, setShowNameInput] = useState(!sessionStorage.getItem('studentName'));
  
  // Server-driven states
  const [currentPoll, setCurrentPoll] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null); // The option selected by this student (index)
  const [pollResults, setPollResults] = useState(null);     // Results data (shown AFTER answering/poll end)
  const [timeLeft, setTimeLeft] = useState(0);
  const [hasAnsweredLocally, setHasAnsweredLocally] = useState(false); // New state to prevent multiple local submissions

  // Derived states for conditional rendering
  const isWaitingForPoll = !currentPoll && !pollResults; // Showing spinner / 'wait for teacher'
  const isPollActiveForStudent = !!currentPoll && !pollResults; // Showing poll question for answering
  const isShowingResults = !!pollResults; // Showing poll results

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io(SOCKET_SERVER_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to backend Socket.io server (Student)', newSocket.id);
      if (studentName) {
        newSocket.emit('registerClient', { role: 'student', name: studentName });
      }
    });

    newSocket.on('initialPollState', (state) => {
      console.log('Initial state received:', state);
      if (state.currentPoll) {
        // If there's an active poll, hide results and show the poll
        setCurrentPoll(state.currentPoll);
        setTimeLeft(state.timeLeft);
        setPollResults(null); 
        setSelectedOption(null);
        setHasAnsweredLocally(false); // Reset for a new poll
      } else if (state.pollHistory && state.pollHistory.length > 0) {
        // If no active poll but history exists, a new student should just wait for a new poll
        // No need to show previous results unless explicitly asked to (brownie points).
        setCurrentPoll(null);
        setPollResults(null);
        setSelectedOption(null);
        setHasAnsweredLocally(false); // Reset as no poll is active
      } else {
        // No active poll and no history (clean state)
        setCurrentPoll(null);
        setPollResults(null);
        setSelectedOption(null);
        setHasAnsweredLocally(false); // Reset
      }
    });

    newSocket.on('newPoll', (poll) => {
      console.log('New poll received:', poll);
      setCurrentPoll(poll);
      setSelectedOption(null); // Reset selected option for new poll
      setPollResults(null);   // Crucial: hide results for new poll
      setTimeLeft(poll.duration);
      setHasAnsweredLocally(false); // A new poll means student hasn't answered it yet
    });

    newSocket.on('pollStateUpdate', (state) => {
      // This event primarily updates live timer for active poll
      if (state.currentPoll && currentPoll && state.currentPoll.id === currentPoll.id) {
        setTimeLeft(state.timeLeft);
        // If student has answered, this updates their results live
        if (isShowingResults) { // Only update if already in results view
            const optionsWithLiveVotes = state.currentPoll.options.map(option => ({
                ...option,
                votes: state.pollResults[option.id] || 0
            }));
            setPollResults(prev => ({ ...prev, options: optionsWithLiveVotes }));
        }
      } else if (!state.currentPoll && currentPoll) {
        // If a poll was active and became inactive (e.g. teacher ended it) but we didn't get pollEnded yet
        // Or if the poll just finished naturally on the server
        // This will trigger the transition to waiting state if no results yet
        setCurrentPoll(null);
        setPollResults(null); // Clear any partial results
        setSelectedOption(null);
        setHasAnsweredLocally(false); // Poll ended or became inactive
      }
    });

    newSocket.on('pollEnded', ({ finalResults, pollId }) => {
      console.log(`Poll ${pollId} ended. Final results:`, finalResults);
      // Ensure we have the full poll details to display results
      if (currentPoll && currentPoll.id === pollId) {
        const finalOptionsWithVotes = currentPoll.options.map(option => ({
          ...option,
          votes: finalResults[option.id] || 0
        }));
        setPollResults({ options: finalOptionsWithVotes, question: currentPoll.question }); // Include question for display
        setCurrentPoll(null); // Mark poll as ended for student
        setSelectedOption(null);
        setHasAnsweredLocally(true); // Poll ended, student shouldn't answer again
      } else if (isShowingResults) {
        // If we are already showing results from a previous manual submission,
        // update them with the server's final results.
        setPollResults(prev => {
          if (prev && prev.question === finalResults.question) { // Basic check if it's the same poll
            const optionsWithLiveVotes = prev.options.map(option => ({
              ...option,
              votes: finalResults[option.id] || 0
            }));
            return { ...prev, options: optionsWithLiveVotes };
          }
          return prev; // Or re-fetch the specific poll by ID from history for accurate question
        });
        setCurrentPoll(null);
        setSelectedOption(null);
        setHasAnsweredLocally(true); // Poll ended, student shouldn't answer again
      } else {
        // If no current poll was active locally but server says poll ended, go to waiting
        setCurrentPoll(null);
        setPollResults(null);
        setSelectedOption(null);
        setHasAnsweredLocally(false); // No active poll
      }
    });

    newSocket.on('error', (message) => {
      alert(`Server Error: ${message}`);
      console.error('Server Error:', message);
    });

    return () => {
      newSocket.off('connect');
      newSocket.off('initialPollState');
      newSocket.off('newPoll');
      newSocket.off('pollStateUpdate');
      newSocket.off('pollEnded');
      newSocket.off('error');
      newSocket.disconnect();
      console.log('Disconnected from backend Socket.io server (Student)');
    };
  }, [studentName, isShowingResults]); // Added isShowingResults to dependency to ensure correct behavior

  const handleSubmitAnswer = () => {
    if (socket && currentPoll && selectedOption !== null) {
      setHasAnsweredLocally(true); // Immediately disable submit button
      const optionId = currentPoll.options[selectedOption].id;
      socket.emit('submitAnswer', { pollId: currentPoll.id, optionId });
      
      // Transition to waiting state after submitting answer
      setCurrentPoll(null); // Student has answered, hide poll form
      setPollResults(null); // Ensure results view is not shown
      setSelectedOption(null); // Reset selection
    }
  };

  const handleNameSubmit = (e) => {
    e.preventDefault();
    if (studentName.trim()) {
      sessionStorage.setItem('studentName', studentName.trim());
      setShowNameInput(false);
      if (socket) {
        socket.emit('registerClient', { role: 'student', name: studentName.trim() });
      }
    }
  };

  const getPercentage = (optionVotes, totalVotes) => {
    return totalVotes === 0 ? 0 : Math.round((optionVotes / totalVotes) * 100);
  };

  const totalVotesInResults = isShowingResults ? pollResults.options.reduce((sum, o) => sum + o.votes, 0) : 0;

  if (showNameInput) {
    return (
      <div className={styles.nameInputOverlay}>
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
        </form>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.dashboard}>
        {isWaitingForPoll && (
          <div className={styles.waitingState}>
            <span className={styles.badge}>Intervue Poll</span>
            <div className={styles.spinner}></div>
            <h1 className={styles.waitingTitle}>Wait for the teacher to ask questions..</h1>
          </div>
        )}

        {isPollActiveForStudent && (
          <div className={styles.pollActiveState}>
            <div className={styles.pollHeader}>
              <span className={styles.questionNumber}>Question 1</span>
              <div className={styles.timer}>
                <span className={styles.timerIcon}></span>
                {timeLeft < 10 ? `0${timeLeft}` : timeLeft}
              </div>
            </div>
            <h2 className={styles.questionText}>{currentPoll.question}</h2>
            <div className={styles.optionsList}>
              {currentPoll.options.map((option, idx) => (
                <label key={option.id} className={styles.optionLabel}>
                  <input
                    type="radio"
                    name="pollOption"
                    value={option.id} // Use option.id for backend
                    checked={selectedOption === idx}
                    onChange={() => setSelectedOption(idx)}
                    className={styles.optionRadio}
                  />
                  <span className={styles.optionText}>{option.text}</span>
                </label>
              ))}
            </div>
            <button
              className={styles.submitBtn}
              onClick={handleSubmitAnswer}
              disabled={selectedOption === null || hasAnsweredLocally}
            >
              Submit
            </button>
          </div>
        )}

        {isShowingResults && (
          <div className={styles.pollResultsState}>
             <div className={styles.pollHeader}>
              <span className={styles.questionNumber}>Question 1</span>
              <div className={styles.timer}>
                <span className={styles.timerIcon}></span>
                00:00
              </div>
            </div>
            <h2 className={styles.questionText}>{pollResults.question || "Poll Results"}</h2>
            <div className={styles.resultsDisplay}>
              {pollResults.options.map((option) => (
                <div key={option.id} className={styles.resultBarContainer}>
                  <span className={styles.resultOptionText}>{option.text}</span>
                  <div className={styles.progressBarWrapper}>
                    <div
                      className={styles.progressBar}
                      style={{ width: `${getPercentage(option.votes, totalVotesInResults)}%` }}
                    ></div>
                    <span className={styles.percentage}>{getPercentage(option.votes, totalVotesInResults)}%</span>
                  </div>
                </div>
              ))}
            </div>
            <p className={styles.waitingForNext}>Wait for the teacher to ask a new question...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default StudentPage; 