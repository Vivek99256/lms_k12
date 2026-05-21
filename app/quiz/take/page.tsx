'use client';

import React, { useState, useEffect } from 'react';
import { Clock, Flag, ChevronRight, ChevronLeft, CheckCircle2, AlertCircle, X, Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const quizData = {
  title: 'Chapter 1: Matter Around Us',
  subject: 'Science',
  totalTimeMinutes: 15,
  questions: [
    { id: 1, text: "Which state of matter has a definite volume but no definite shape?", options: ["Solid", "Liquid", "Gas", "Plasma"], correctIndex: 1 },
    { id: 2, text: "What is the process by which a gas changes into a liquid?", options: ["Evaporation", "Condensation", "Melting", "Sublimation"], correctIndex: 1 },
    { id: 3, text: "Which of the following is an example of a physical change?", options: ["Burning wood", "Rusting iron", "Melting ice", "Baking a cake"], correctIndex: 2 },
    { id: 4, text: "The particles in a solid are:", options: ["Packed closely together", "Far apart and moving freely", "Slightly apart and sliding", "Not moving at all"], correctIndex: 0 },
    { id: 5, text: "What happens to the kinetic energy of particles when temperature increases?", options: ["It decreases", "It increases", "It stays the same", "It becomes zero"], correctIndex: 1 }
  ]
};

export default function TakeQuizPage() {
  const router = useRouter();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [flagged, setFlagged] = useState<Record<number, boolean>>({});
  const [timeLeft, setTimeLeft] = useState(quizData.totalTimeMinutes * 60);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Timer Effect
  useEffect(() => {
    if (timeLeft <= 0 || isSubmitted) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, isSubmitted]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleOptionSelect = (optionIndex: number) => {
    if (isSubmitted) return;
    setAnswers({
      ...answers,
      [currentQuestionIndex]: optionIndex
    });
  };

  const toggleFlag = () => {
    setFlagged({
      ...flagged,
      [currentQuestionIndex]: !flagged[currentQuestionIndex]
    });
  };

  const handleNext = () => {
    if (currentQuestionIndex < quizData.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmit = () => {
    setIsSubmitted(true);
  };

  const currentQuestion = quizData.questions[currentQuestionIndex];
  const answeredCount = Object.keys(answers).length;
  const progressPercent = (answeredCount / quizData.questions.length) * 100;

  if (isSubmitted) {
    let score = 0;
    quizData.questions.forEach((q, index) => {
      if (answers[index] === q.correctIndex) score++;
    });
    const percentage = Math.round((score / quizData.questions.length) * 100);

    return (
      <div className="h-screen bg-[#F8FAFC] flex flex-col font-sans overflow-hidden">
        <header className="shrink-0 bg-white border-b border-gray-100 h-20 px-8 flex items-center justify-between z-50 shadow-sm">
          <div className="flex items-center gap-4">
            <Link href="/chapters" className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">
              <X size={20} />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">{quizData.title} Review</h1>
              <p className="text-sm text-gray-500">Your Score: {score}/{quizData.questions.length} ({percentage}%)</p>
            </div>
          </div>
          <button onClick={() => router.push('/chapters')} className="px-6 py-2.5 bg-[#0D6EFD] text-white rounded-xl font-bold shadow-md hover:bg-blue-700 transition-colors">
            Return to Chapter
          </button>
        </header>

        <div className="flex-1 overflow-y-auto w-full p-8">
          <main className="max-w-4xl mx-auto space-y-6 pb-24">
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Assessment Complete</h2>
                <p className="text-gray-500">Review your answers below.</p>
              </div>
              <div className="flex gap-4">
                <div className="bg-gray-50 p-4 rounded-2xl text-center min-w-[100px]">
                  <div className="text-sm text-gray-500 mb-1">Score</div>
                  <div className={`text-2xl font-bold ${percentage >= 60 ? 'text-emerald-600' : 'text-red-600'}`}>{percentage}%</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl text-center min-w-[100px]">
                  <div className="text-sm text-gray-500 mb-1">Time Taken</div>
                  <div className="text-2xl font-bold text-blue-600">{formatTime(quizData.totalTimeMinutes * 60 - timeLeft)}</div>
                </div>
              </div>
            </div>

            {quizData.questions.map((q, qIndex) => {
              const userAnswer = answers[qIndex];
              const isCorrect = userAnswer === q.correctIndex;
              const isUnanswered = userAnswer === undefined;

              return (
                <div key={q.id} className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start mb-6">
                    <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                      Question {qIndex + 1}
                    </span>
                    {isUnanswered ? (
                      <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-full">Unanswered</span>
                    ) : isCorrect ? (
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full flex items-center gap-1"><CheckCircle2 size={14}/> Correct</span>
                    ) : (
                      <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full flex items-center gap-1"><AlertCircle size={14}/> Incorrect</span>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-6">{q.text}</h3>
                  <div className="space-y-3">
                    {q.options.map((opt, oIndex) => {
                      const isSelected = userAnswer === oIndex;
                      const isActuallyCorrect = q.correctIndex === oIndex;
                      
                      let style = "border-gray-100 bg-white";
                      let icon = String.fromCharCode(65 + oIndex);
                      
                      if (isActuallyCorrect) {
                        style = "border-emerald-500 bg-emerald-50";
                      } else if (isSelected && !isActuallyCorrect) {
                        style = "border-red-500 bg-red-50";
                      }

                      return (
                        <div key={oIndex} className={`flex items-center p-4 rounded-2xl border-2 ${style}`}>
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm mr-4 
                            ${isActuallyCorrect ? 'bg-emerald-500 text-white' : 
                              (isSelected && !isActuallyCorrect) ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                            {isActuallyCorrect ? <Check size={16} strokeWidth={3} /> : (isSelected && !isActuallyCorrect) ? <X size={16} strokeWidth={3} /> : icon}
                          </div>
                          <span className={`text-base font-medium ${isActuallyCorrect ? 'text-emerald-900' : (isSelected && !isActuallyCorrect) ? 'text-red-900' : 'text-gray-700'}`}>
                            {opt}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#F8FAFC] flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="shrink-0 bg-white border-b border-gray-100 h-20 px-8 flex items-center justify-between z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/chapters" className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">
            <X size={20} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">{quizData.title}</h1>
            <p className="text-sm text-gray-500">{quizData.subject} Assessment</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className={`flex items-center gap-3 px-5 py-2.5 rounded-full font-bold text-lg tracking-wider transition-colors duration-500 ${timeLeft < 300 ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-gray-50 text-gray-700'}`}>
            <Clock size={20} className={timeLeft < 300 ? 'text-red-500' : 'text-gray-400'} />
            {formatTime(timeLeft)}
          </div>
          <button onClick={handleSubmit} className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-bold shadow-md hover:bg-gray-800 transition-colors">
            Submit Quiz
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto w-full">
        <main className="max-w-7xl w-full mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-full">
          
          {/* Left Area: Question */}
          <div className="lg:col-span-8 flex flex-col">
          {/* Progress Bar */}
          <div className="mb-3">
            <div className="flex justify-between text-sm font-semibold text-gray-500 mb-2">
              <span>Question {currentQuestionIndex + 1} of {quizData.questions.length}</span>
              <span className="text-[#0D6EFD]">{progressPercent.toFixed(0)}% Completed</span>
            </div>
            <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#0D6EFD] rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>

          {/* Question Card */}
          <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-gray-100 flex-1 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-[4rem] -mr-10 -mt-10 pointer-events-none"></div>
            
            <div className="flex justify-between items-start mb-4 relative">
              <span className="text-sm font-bold text-blue-600 bg-blue-50 px-4 py-1.5 rounded-full uppercase tracking-wider">
                Question {currentQuestionIndex + 1}
              </span>
              <button 
                onClick={toggleFlag}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${flagged[currentQuestionIndex] ? 'bg-orange-50 text-orange-600 border border-orange-200' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <Flag size={16} className={flagged[currentQuestionIndex] ? 'fill-orange-600' : ''} /> 
                {flagged[currentQuestionIndex] ? 'Flagged' : 'Flag for review'}
              </button>
            </div>

            <h2 className="text-xl font-bold text-gray-900 mb-3 leading-snug">
              {currentQuestion.text}
            </h2>

            {/* Options */}
            <div className="space-y-1 mb-auto">
              {currentQuestion.options.map((option, index) => {
                const isSelected = answers[currentQuestionIndex] === index;
                const letter = String.fromCharCode(65 + index); // A, B, C, D
                
                return (
                  <div 
                    key={index}
                    onClick={() => handleOptionSelect(index)}
                    className={`group flex items-center p-3 rounded-2xl border-2 cursor-pointer transition-all duration-300 transform hover:-translate-y-0.5 ${isSelected ? 'border-[#0D6EFD] bg-blue-50/50 shadow-md shadow-blue-500/10' : 'border-gray-100 hover:border-gray-300 bg-white'}`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs mr-5 transition-colors ${isSelected ? 'bg-[#0D6EFD] text-white shadow-inner' : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'}`}>
                      {isSelected ? <Check size={20} strokeWidth={3} /> : letter}
                    </div>
                    <span className={`text-base font-medium transition-colors ${isSelected ? 'text-blue-900' : 'text-gray-700 group-hover:text-gray-900'}`}>
                      {option}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center mt-3 pt-4 border-t border-gray-100">
              <button 
                onClick={handlePrev}
                disabled={currentQuestionIndex === 0}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={20} /> Previous
              </button>
              
              {currentQuestionIndex === quizData.questions.length - 1 ? (
                <button 
                  onClick={handleSubmit}
                  className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold bg-[#0D6EFD] text-white shadow-md shadow-blue-500/30 hover:-translate-y-0.5 transition-all"
                >
                  Submit <CheckCircle2 size={20} />
                </button>
              ) : (
                <button 
                  onClick={handleNext}
                  className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold bg-[#0D6EFD] text-white shadow-md shadow-blue-500/30 hover:-translate-y-0.5 transition-all"
                >
                  Next <ChevronRight size={20} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Area: Quiz Navigator */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 sticky top-28">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Quiz Navigator</h3>
            
            <div className="grid grid-cols-5 gap-3 mb-8">
              {quizData.questions.map((_, index) => {
                const isAnswered = answers[index] !== undefined;
                const isCurrent = currentQuestionIndex === index;
                const isFlagged = flagged[index];
                
                return (
                  <button
                    key={index}
                    onClick={() => setCurrentQuestionIndex(index)}
                    className={`
                      w-12 h-12 rounded-xl text-sm font-bold flex items-center justify-center relative transition-all duration-300
                      ${isCurrent ? 'ring-4 ring-blue-100 scale-110 z-10' : 'hover:bg-gray-100'}
                      ${isAnswered ? 'bg-[#0D6EFD] text-white shadow-sm' : 'bg-gray-50 text-gray-500 border border-gray-200'}
                      ${isCurrent && isAnswered ? 'bg-blue-700' : ''}
                    `}
                  >
                    {index + 1}
                    {isFlagged && (
                      <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-orange-500 rounded-full border-2 border-white flex items-center justify-center"></div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="space-y-3 pt-6 border-t border-gray-100">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <div className="w-4 h-4 rounded bg-[#0D6EFD]"></div> Answered
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <div className="w-4 h-4 rounded bg-gray-50 border border-gray-200"></div> Unanswered
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <div className="w-4 h-4 rounded-full bg-orange-500"></div> Flagged for Review
              </div>
            </div>
          </div>
        </div>

        </main>
      </div>
    </div>
  );
}
