import React, { useEffect, useState } from 'react';
import { ReviewFeedback, Severity } from '../../../types';
import { AddCommentIcon, CheckmarkIcon, EditIcon, EyeSlashIcon, TrashIcon } from './icons';
import { Spinner } from './Spinner';

const BugIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path
      fillRule="evenodd"
      d="M10 2a8 8 0 100 16 8 8 0 000-16zM6.343 6.343a.75.75 0 011.06 0L10 8.94l2.597-2.597a.75.75 0 111.06 1.06L11.06 10l2.597 2.597a.75.75 0 11-1.06 1.06L10 11.06l-2.597 2.597a.75.75 0 01-1.06-1.06L8.94 10 6.343 7.403a.75.75 0 010-1.06z"
      clipRule="evenodd"
    />
  </svg>
);

const WarningIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path
      fillRule="evenodd"
      d="M8.257 3.099c.623-1.08 2.041-1.08 2.664 0l5.857 10.143a1.625 1.625 0 01-1.332 2.458H3.732a1.625 1.625 0 01-1.332-2.458L8.257 3.099zM10 12.5a1 1 0 100-2 1 1 0 000 2zm0-5a1 1 0 00-1 1v2a1 1 0 102 0V8.5a1 1 0 00-1-1z"
      clipRule="evenodd"
    />
  </svg>
);

const LightbulbIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.657a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 14.95a1 1 0 001.414 1.414l.707-.707a1 1 0 00-1.414-1.414l-.707.707zM4 10a1 1 0 01-1-1H2a1 1 0 110-2h1a1 1 0 011 1zM10 18a1 1 0 001-1v-1a1 1 0 10-2 0v1a1 1 0 001 1zM8.94 6.553a1 1 0 00-1.88 0l-1.023 2.046A3.5 3.5 0 005.5 12.5a1.5 1.5 0 003 0 3.5 3.5 0 00-1.477-2.901L8.94 6.553zM12 11.5a1.5 1.5 0 01-3 0 3.5 3.5 0 015.953-2.901l-1.023-2.046a1 1 0 01-1.88 0L12 6.553V11.5z" />
  </svg>
);

const InfoIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path
      fillRule="evenodd"
      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
      clipRule="evenodd"
    />
  </svg>
);

const ChevronDownIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4"
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path
      fillRule="evenodd"
      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
      clipRule="evenodd"
    />
  </svg>
);

const SEVERITY_CONFIG = {
  [Severity.Critical]: {
    icon: <BugIcon />,
  },
  [Severity.Warning]: {
    icon: <WarningIcon />,
  },
  [Severity.Suggestion]: {
    icon: <LightbulbIcon />,
  },
  [Severity.Info]: {
    icon: <InfoIcon />,
  },
};

interface FeedbackCardProps {
  feedback: ReviewFeedback;
  onPostComment: (id: string) => void;
  onUpdateFeedback: (id: string, title: string, description: string, severity: Severity) => void;
  onDeleteFeedback: (id: string) => void;
  onSetEditing: (id: string, isEditing: boolean) => void;
  onToggleIgnoreFeedback: (id: string) => void;
}

export const FeedbackCard: React.FC<FeedbackCardProps> = ({
  feedback,
  onPostComment,
  onUpdateFeedback,
  onDeleteFeedback,
  onSetEditing,
  onToggleIgnoreFeedback,
}) => {
  const [editedDescription, setEditedDescription] = useState(feedback.description);
  const [editedSeverity, setEditedSeverity] = useState(feedback.severity);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    if (feedback.isEditing) {
      setEditedDescription(feedback.description);
      setEditedSeverity(feedback.severity);
    }
  }, [feedback.isEditing, feedback.description, feedback.severity]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isDropdownOpen) {
        const target = event.target as Element;
        // Check if the click is outside the dropdown
        const dropdownElement = document.querySelector(`[data-dropdown-id="${feedback.id}"]`);
        if (dropdownElement && !dropdownElement.contains(target)) {
          setIsDropdownOpen(false);
        }
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen, feedback.id]);

  const handleSave = () => {
    onUpdateFeedback(feedback.id, feedback.title, editedDescription, editedSeverity);
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
  };

  if (feedback.isEditing) {
    return (
      <div className="shadow-md bg-white dark:bg-gray-800 border-2 border-blue-300 dark:border-blue-700 rounded-md">
        <div className="p-2">
          <label
            htmlFor={`description-${feedback.id}`}
            className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            {feedback.isNewlyAdded ? 'Add New Comment' : `Edit Comment: ${feedback.title}`}
          </label>
          <textarea
            id={`description-${feedback.id}`}
            value={editedDescription}
            onChange={(e) => setEditedDescription(e.target.value)}
            placeholder="Detailed explanation and suggestions..."
            className="w-full p-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 text-xs font-mono rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            rows={3}
            autoFocus
          ></textarea>
        </div>
        <div className="px-2 py-1.5 bg-blue-50 dark:bg-blue-950/30 rounded-b-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onDeleteFeedback(feedback.id)}
                className="p-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-red-100 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                aria-label="Delete comment"
              >
                <TrashIcon />
              </button>
              <div className="relative" data-dropdown-id={feedback.id}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center space-x-1 text-xs text-gray-700 dark:text-gray-200 font-semibold py-1 px-2 bg-gray-100 dark:bg-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                >
                  <span className="text-gray-600 dark:text-gray-300">
                    {SEVERITY_CONFIG[editedSeverity].icon}
                  </span>
                  <span>{editedSeverity}</span>
                  <ChevronDownIcon />
                </button>
                {isDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-10 min-w-[120px]">
                    {Object.entries(SEVERITY_CONFIG).map(([severity, config]) => (
                      <button
                        key={severity}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditedSeverity(severity as Severity);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full flex items-center space-x-2 px-3 py-2 text-xs text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors first:rounded-t-md last:rounded-b-md ${
                          editedSeverity === severity ? 'bg-gray-100 dark:bg-gray-700' : ''
                        }`}
                      >
                        <span className="text-gray-600 dark:text-gray-300">{config.icon}</span>
                        <span className="text-gray-800 dark:text-gray-200">{severity}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleCancel}
                className="text-xs text-gray-600 dark:text-gray-300 font-semibold py-1 px-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!editedDescription.trim()}
                className="text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-1 px-2 rounded-md transition-all"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If this is an existing comment from GitLab
  if (feedback.isExisting) {
    return (
      <div className="transition-all duration-300 shadow-md bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-md font-sans">
        <div className="p-1.5">
          <div className="flex items-start space-x-2">
            <div className="mt-0.5 text-gray-500 dark:text-gray-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H11.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9Z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                  {feedback.title}
                </h3>
                <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded-full ml-2">
                  Existing
                </span>
              </div>
              <p className="mt-0.5 text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {feedback.description}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const config = SEVERITY_CONFIG[feedback.severity] || SEVERITY_CONFIG[Severity.Info];

  return (
    <div className="transition-all duration-300 shadow-md bg-white dark:bg-gray-800 border-2 border-blue-200 dark:border-blue-800 rounded-md">
      <div className={`p-1.5 ${feedback.isIgnored ? 'opacity-60' : ''}`}>
        <div className="flex items-start space-x-2">
          <div className="mt-0.5 text-gray-600 dark:text-gray-300">{config.icon}</div>
          <div className="flex-1">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                {feedback.title}
              </h3>
            </div>
            <p className="mt-0.5 text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {feedback.description}
            </p>
          </div>
        </div>
      </div>
      <div className="px-1.5 py-1 bg-blue-50 dark:bg-blue-950/30 flex items-center justify-between rounded-b-md">
        {feedback.isIgnored ? (
          <>
            <span className="text-xs italic text-gray-600 dark:text-gray-400">Comment ignored</span>
            <button
              onClick={() => onToggleIgnoreFeedback(feedback.id)}
              className="text-xs text-gray-600 dark:text-gray-300 font-semibold py-0.5 px-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              Undo
            </button>
          </>
        ) : (
          <>
            <div>
              {feedback.status === 'pending' && (
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => onSetEditing(feedback.id, true)}
                    className="flex items-center space-x-1 text-xs text-gray-600 dark:text-gray-300 font-semibold py-0.5 px-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    <EditIcon />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => onToggleIgnoreFeedback(feedback.id)}
                    className="flex items-center space-x-1 text-xs text-gray-600 dark:text-gray-300 font-semibold py-0.5 px-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    aria-label="Ignore comment"
                  >
                    <EyeSlashIcon />
                    <span>Ignore</span>
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-1">
              {feedback.status === 'error' && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  Error: {feedback.submissionError}
                </p>
              )}

              {feedback.status === 'pending' && (
                <button
                  onClick={handleAction}
                  className="flex items-center space-x-1 text-xs bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 text-white font-semibold py-0.5 px-1.5 rounded-md transition-colors"
                >
                  <AddCommentIcon />
                  <span>Add to MR</span>
                </button>
              )}
              {feedback.status === 'submitting' && (
                <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400 py-0.5 px-1.5">
                  <Spinner size="sm" /> <span>Posting...</span>
                </div>
              )}
              {feedback.status === 'submitted' && (
                <div className="flex items-center space-x-1 text-xs text-green-600 dark:text-green-400 py-0.5 px-1.5">
                  <CheckmarkIcon />
                  <span>Posted on GitLab</span>
                </div>
              )}
              {feedback.status === 'error' && (
                <button
                  onClick={handleAction}
                  className="flex items-center space-x-1 text-xs bg-red-600 hover:bg-red-500 text-white font-semibold py-0.5 px-1.5 rounded-md transition-colors"
                >
                  <span>Retry</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
