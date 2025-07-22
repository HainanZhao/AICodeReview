import React, { useState, useMemo, useEffect } from 'react';
import { ReviewFeedback, Severity } from '../types';
import { AddCommentIcon, EditIcon, TrashIcon, EyeSlashIcon } from './icons';
import { Spinner } from './Spinner';

const BugIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 2a8 8 0 100 16 8 8 0 000-16zM6.343 6.343a.75.75 0 011.06 0L10 8.94l2.597-2.597a.75.75 0 111.06 1.06L11.06 10l2.597 2.597a.75.75 0 11-1.06 1.06L10 11.06l-2.597 2.597a.75.75 0 01-1.06-1.06L8.94 10 6.343 7.403a.75.75 0 010-1.06z" clipRule="evenodd" />
    </svg>
);

const WarningIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M8.257 3.099c.623-1.08 2.041-1.08 2.664 0l5.857 10.143a1.625 1.625 0 01-1.332 2.458H3.732a1.625 1.625 0 01-1.332-2.458L8.257 3.099zM10 12.5a1 1 0 100-2 1 1 0 000 2zm0-5a1 1 0 00-1 1v2a1 1 0 102 0V8.5a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
);

const LightbulbIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.657a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 14.95a1 1 0 001.414 1.414l.707-.707a1 1 0 00-1.414-1.414l-.707.707zM4 10a1 1 0 01-1-1H2a1 1 0 110-2h1a1 1 0 011 1zM10 18a1 1 0 001-1v-1a1 1 0 10-2 0v1a1 1 0 001 1zM8.94 6.553a1 1 0 00-1.88 0l-1.023 2.046A3.5 3.5 0 005.5 12.5a1.5 1.5 0 003 0 3.5 3.5 0 00-1.477-2.901L8.94 6.553zM12 11.5a1.5 1.5 0 01-3 0 3.5 3.5 0 015.953-2.901l-1.023-2.046a1 1 0 01-1.88 0L12 6.553V11.5z" />
    </svg>
);

const InfoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
    </svg>
);


const SEVERITY_CONFIG = {
  [Severity.Critical]: { icon: <BugIcon />, colorClass: 'border-red-500/50 dark:bg-red-900/40 bg-red-50 text-red-800 dark:text-red-300', titleColor: 'text-red-600 dark:text-red-400' },
  [Severity.Warning]: { icon: <WarningIcon />, colorClass: 'border-yellow-500/50 dark:bg-yellow-900/40 bg-yellow-50 text-yellow-800 dark:text-yellow-300', titleColor: 'text-yellow-600 dark:text-yellow-400' },
  [Severity.Suggestion]: { icon: <LightbulbIcon />, colorClass: 'border-blue-500/50 dark:bg-blue-900/40 bg-blue-50 text-blue-800 dark:text-blue-300', titleColor: 'text-blue-600 dark:text-blue-400' },
  [Severity.Info]: { icon: <InfoIcon />, colorClass: 'border-gray-500/50 dark:bg-gray-800/40 bg-gray-100 text-gray-800 dark:text-gray-300', titleColor: 'text-gray-600 dark:text-gray-400' },
};

interface FeedbackCardProps {
  feedback: ReviewFeedback;
  onPostComment: (id: string) => void;
  onUpdateFeedback: (id: string, title: string, description: string, severity: Severity) => void;
  onDeleteFeedback: (id: string) => void;
  onSetEditing: (id: string, isEditing: boolean) => void;
  onToggleIgnoreFeedback: (id: string) => void;
}

export const FeedbackCard: React.FC<FeedbackCardProps> = ({ feedback, onPostComment, onUpdateFeedback, onDeleteFeedback, onSetEditing, onToggleIgnoreFeedback }) => {
  const [editedDescription, setEditedDescription] = useState(feedback.description);

  useEffect(() => {
    if (feedback.isEditing) {
      setEditedDescription(feedback.description);
    }
  }, [feedback.isEditing, feedback.description]);

  const handleSave = () => {
    onUpdateFeedback(feedback.id, feedback.title, editedDescription, feedback.severity);
  };

  const handleCancel = () => {
    if (feedback.isNewlyAdded) {
      onDeleteFeedback(feedback.id);
    } else {
      onSetEditing(feedback.id, false);
    }
  };
  
  const handleAction = () => {
    if ((feedback.status === 'pending' || feedback.status === 'error') && !feedback.isEditing) {
        onPostComment(feedback.id);
    }
  }

  if (feedback.isEditing) {
    const config = SEVERITY_CONFIG[feedback.severity] || SEVERITY_CONFIG[Severity.Info];
    return (
      <div className={`shadow-lg ${config.colorClass} border-l-4 rounded-md`}>
        <div className="p-4">
            <label htmlFor={`description-${feedback.id}`} className="block text-sm font-medium text-gray-700 dark:text-brand-subtle mb-1">
              {feedback.isNewlyAdded ? 'Add New Comment' : `Edit Comment: ${feedback.title}`}
            </label>
            <textarea id={`description-${feedback.id}`} value={editedDescription} onChange={(e) => setEditedDescription(e.target.value)} placeholder="Detailed explanation and suggestions..." className="w-full p-2 bg-gray-100 dark:bg-brand-primary border border-gray-300 dark:border-brand-primary/50 text-gray-800 dark:text-brand-text text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-brand-secondary" rows={5} autoFocus></textarea>
        </div>
        <div className="px-4 py-2 bg-black/10 dark:bg-black/20 flex items-center justify-between rounded-b-md">
           <button onClick={() => onDeleteFeedback(feedback.id)} className="p-2 rounded-full text-gray-500 dark:text-brand-subtle hover:bg-red-200 dark:hover:bg-red-800/50 hover:text-red-700 dark:hover:text-red-300 transition-colors" aria-label="Delete comment">
              <TrashIcon />
           </button>
           <div className="flex items-center space-x-2">
                <button onClick={handleCancel} className="text-sm text-gray-700 dark:text-brand-subtle font-semibold py-2 px-4 rounded-md hover:bg-gray-300/50 dark:hover:bg-brand-primary/80 transition-colors">Cancel</button>
                <button onClick={handleSave} disabled={!editedDescription.trim()} className="text-sm bg-brand-secondary hover:bg-red-600 disabled:bg-gray-300 dark:disabled:bg-brand-primary disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md transition-all">Save</button>
           </div>
        </div>
      </div>
    );
  }

  const config = SEVERITY_CONFIG[feedback.severity] || SEVERITY_CONFIG[Severity.Info];
  return (
    <div className={`transition-all duration-300 shadow-lg ${config.colorClass} border-l-4 rounded-md`}>
      <div className={`p-4 ${feedback.isIgnored ? 'opacity-60' : ''}`}>
        <div className="flex items-start space-x-3">
            <div className={`mt-1 ${config.titleColor}`}>{config.icon}</div>
            <div className="flex-1">
                <div className="flex justify-between items-center">
                    <h3 className={`text-md font-bold ${config.titleColor}`}>{feedback.title}</h3>
                </div>
                <p className="mt-2 text-sm text-gray-800 dark:text-brand-text whitespace-pre-wrap">{feedback.description}</p>
            </div>
        </div>
      </div>
       {feedback.severity !== Severity.Info && (
            <div className="px-4 py-2 bg-black/10 dark:bg-black/20 flex items-center justify-between rounded-b-md">
                {feedback.isIgnored ? (
                     <>
                        <span className="text-sm italic text-gray-600 dark:text-brand-subtle">Comment ignored</span>
                        <button onClick={() => onToggleIgnoreFeedback(feedback.id)} className="text-sm text-gray-700 dark:text-brand-subtle font-semibold py-2 px-4 rounded-md hover:bg-gray-300/50 dark:hover:bg-brand-primary/80 transition-colors">
                            Undo
                        </button>
                    </>
                ) : (
                    <>
                        <div>
                            {feedback.status === 'pending' && (
                                <div className="flex items-center space-x-1">
                                    <button onClick={() => onSetEditing(feedback.id, true)} className="flex items-center space-x-2 text-sm text-gray-600 dark:text-brand-subtle font-semibold py-1 px-3 rounded-md hover:bg-gray-300/50 dark:hover:bg-brand-primary/80 transition-colors">
                                        <EditIcon />
                                        <span>Edit</span>
                                    </button>
                                     <button onClick={() => onToggleIgnoreFeedback(feedback.id)} className="flex items-center space-x-2 text-sm text-gray-600 dark:text-brand-subtle font-semibold py-1 px-3 rounded-md hover:bg-gray-300/50 dark:hover:bg-brand-primary/80 transition-colors" aria-label="Ignore comment">
                                        <EyeSlashIcon />
                                        <span>Ignore</span>
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center space-x-2">
                            {feedback.status === 'error' && <p className="text-xs text-red-600 dark:text-red-400">Error: {feedback.submissionError}</p>}
                            
                            {feedback.status === 'pending' && (
                                <button onClick={handleAction} className="flex items-center space-x-2 text-sm bg-gray-600 dark:bg-brand-primary hover:bg-brand-secondary text-white font-semibold py-1 px-3 rounded-md transition-colors">
                                    <AddCommentIcon />
                                    <span>Add to MR</span>
                                </button>
                            )}
                            {feedback.status === 'submitting' && <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-brand-subtle py-1 px-3"><Spinner size="sm" /> <span>Posting...</span></div>}
                            {feedback.status === 'submitted' && <div className="text-sm text-green-600 dark:text-green-400 py-1 px-3">✓ Posted</div>}
                            {feedback.status === 'error' && (
                                <button onClick={handleAction} className="flex items-center space-x-2 text-sm bg-red-600 hover:bg-red-500 text-white font-semibold py-1 px-3 rounded-md transition-colors">
                                    <span>Retry</span>
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        )}
    </div>
  );
};
