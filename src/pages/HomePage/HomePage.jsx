import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './HomePage.module.css';

function HomePage() {
  const [selectedRole, setSelectedRole] = useState(null);
  const navigate = useNavigate();

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    // For now, just log the selection. We'll add routing later
    console.log(`Selected role: ${role}`);
  };

  const handleContinue = () => {
    if (selectedRole === 'teacher') {
      navigate('/teacher');
    } else if (selectedRole === 'student') {
      navigate('/student');
    }
  };

  return (
    <div className={styles.app}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>Live Polling System</h1>
          <p className={styles.subtitle}>Interactive real-time polling for classrooms</p>
        </header>

        <main className={styles.main}>
          <div className={styles['role-selection']}>
            <h2 className={styles['role-title']}>Choose Your Role</h2>
            <div className={styles['role-cards']}>
              <div
                className={`${styles['role-card']} ${selectedRole === 'teacher' ? styles.selected : ''}`}
                onClick={() => handleRoleSelect('teacher')}
              >
                <div className={styles['role-icon']}>👨‍🏫</div>
                <h3 className={styles['role-name']}>Teacher</h3>
                <p className={styles['role-description']}>
                  Create polls, view live results, and manage the classroom
                </p>
                <ul className={styles['role-features']}>
                  <li>• Create new polls</li>
                  <li>• View live results</li>
                  <li>• Manage student responses</li>
                </ul>
              </div>

              <div
                className={`${styles['role-card']} ${selectedRole === 'student' ? styles.selected : ''}`}
                onClick={() => handleRoleSelect('student')}
              >
                <div className={styles['role-icon']}>👨‍🎓</div>
                <h3 className={styles['role-name']}>Student</h3>
                <p className={styles['role-description']}>
                  Answer polls and view real-time results
                </p>
                <ul className={styles['role-features']}>
                  <li>• Answer poll questions</li>
                  <li>• View live results</li>
                  <li>• 60-second time limit</li>
                </ul>
              </div>
            </div>

            {selectedRole && (
              <div className={styles['role-actions']}>
                <button className={styles['continue-btn']} onClick={handleContinue}>
                  Continue as {selectedRole === 'teacher' ? 'Teacher' : 'Student'}
                </button>
                <button
                  className={styles['change-role-btn']}
                  onClick={() => setSelectedRole(null)}
                >
                  Choose Different Role
                </button>
              </div>
            )}
          </div>
        </main>

        <footer className={styles.footer}>
          <p>Built with React, Express.js, and Socket.io</p>
        </footer>
      </div>
    </div>
  );
}

export default HomePage;
