import React, { useEffect, useState } from 'react';
import socket from '../utils/socket';
import Timer from './Timer';
import Button from './Button';

interface GameCard {
  category: string;
  questions: string[];
}

interface QuestionSelectionProps {
  lobbyCode: string;
  isLeader: boolean;
  leaderName: string;
}

const QuestionSelection: React.FC<QuestionSelectionProps> = ({ lobbyCode, isLeader, leaderName }) => {
  const [questions, setQuestions] = useState<GameCard[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(isLeader);

  useEffect(() => {
    if (isLeader) {
      // Le chef demande les questions
      socket.emit('requestQuestions', { lobbyCode });
      socket.emit('startTimer', { lobbyCode, duration: 30 }); // 30 secondes pour choisir
    }

    socket.on('questionsReceived', (data: { questions: GameCard[] }) => {
      setQuestions(data.questions);
      setLoading(false);
    });

    return () => {
      socket.off('questionsReceived');
    };
  }, [isLeader, lobbyCode]);

  const handleSelectQuestion = (index: number) => {
    if (!isLeader || selectedIndex !== null) return;

    const selectedCard = questions[index];
    // Sélectionner la première question de la carte (ou permettre de choisir parmi les 3)
    const selectedQuestion = selectedCard.questions[0];

    setSelectedIndex(index);
    socket.emit('selectQuestion', { lobbyCode, selectedQuestion });
  };

  const handleTimerExpire = () => {
    socket.emit('timerExpired', { lobbyCode });
  };

  if (!isLeader) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '30px' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 'bold', color: 'white', marginBottom: '16px' }}>Sélection de la question</h2>
          <p style={{ fontSize: '20px', color: 'rgba(255,255,255,0.8)' }}>
            {leaderName} choisit une question...
          </p>
        </div>
        <div style={{ fontSize: '60px' }}>🤔</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '60px', marginBottom: '16px' }}>⏳</div>
          <p style={{ fontSize: '20px', color: 'white' }}>Chargement des questions...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '32px', fontWeight: 'bold', color: 'white', marginBottom: '16px', textAlign: 'center' }}>
          Choisissez une question
        </h2>
        <Timer duration={30} onExpire={handleTimerExpire} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', flex: 1 }}>
        {questions.map((card, index) => (
          <div
            key={index}
            onClick={() => handleSelectQuestion(index)}
            style={{
              position: 'relative',
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '24px',
              cursor: 'pointer',
              boxShadow: selectedIndex === index ? '0 0 0 4px #30c94d' : '0 2px 10px rgba(0,0,0,0.4)',
              transition: 'all 0.3s ease',
              transform: selectedIndex === index ? 'scale(1.05)' : 'scale(1)',
              opacity: selectedIndex !== null && selectedIndex !== index ? 0.5 : 1,
            }}
            onMouseOver={(e) => {
              if (selectedIndex === null) {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)';
              }
            }}
            onMouseOut={(e) => {
              if (selectedIndex !== index) {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.4)';
              }
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{
                backgroundColor: '#1f5d90',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                padding: '6px 12px',
                borderRadius: '20px',
                marginBottom: '16px',
                alignSelf: 'flex-start'
              }}>
                {card.category}
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ fontSize: '18px', fontWeight: '500', textAlign: 'center', color: '#333' }}>
                  {card.questions[0]}
                </p>
              </div>
              {selectedIndex === index && (
                <div style={{ position: 'absolute', top: '16px', right: '16px', fontSize: '40px' }}>✅</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedIndex !== null && (
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <p style={{ color: '#30c94d', fontSize: '20px', fontWeight: '600' }}>
            Question sélectionnée! Passage à la phase suivante...
          </p>
        </div>
      )}
    </div>
  );
};

export default QuestionSelection;
