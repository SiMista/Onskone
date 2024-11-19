export interface IRound {
    roundNumber: number;  
    questions: string[];            
    answers: string[];              
    scores: Record<string, number>; // Scores des joueurs pour ce round (clé = ID du joueur, valeur = score)
    currentQuestionIndex: number;   // L'index de la question actuelle
    nextQuestion(): void;        
    calculateScores(): void;    
  }
  