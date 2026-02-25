import type React from 'react';
import { useEffect, useState } from 'react';
import { type ReviewFeedback, Severity } from '../../../types';
import { Button } from './Button';
import { Spinner } from './Spinner';
import { CheckmarkIcon, EditIcon, EyeSlashIcon } from './icons';

const BugIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4 text-[#db3b21]"
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
    className="h-4 w-4 text-[#e75e00]"
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
    className="h-4 w-4 text-[#1f75cb]"
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.657a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 14.95a1 1 0 001.414 1.414l.707-.707a1 1 0 00-1.414-1.414l-.707.707zM4 10a1 1 0 01-1-1H2a1 1 0 110-2h1a1 1 0 011 1zM10 18a1 1 0 001-1v-1a1 1 0 10-2 0v1a1 1 0 001 1zM8.94 6.553a1 1 0 00-1.88 0l-1.023 2.046A3.5 3.5 0 005.5 12.5a1.5 1.5 0 003 0 3.5 3.5 0 00-1.477-2.901L8.94 6.553zM12 11.5a1.5 1.5 0 01-3 0 3.5 3.5 0 015.953-2.901l-1.023-2.046a1 1 0 01-1.88 0L12 6.553V11.5z" />
  </svg>
);

const InfoIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4 text-[#444444] dark:text-[#a1a1aa]"
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
    className="h-3.5 w-3.5"
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
    labelClass: 'text-[#db3b21] bg-[#db3b21]/10',
  },
  [Severity.Warning]: {
    icon: <WarningIcon />,
    labelClass: 'text-[#e75e00] bg-[#e75e00]/10',
  },
  [Severity.Suggestion]: {
    icon: <LightbulbIcon />,
    labelClass: 'text-[#1f75cb] bg-[#1f75cb]/10',
  },
  [Severity.Info]: {
    icon: <InfoIcon />,
    labelClass: 'text-[#444444] dark:text-[#a1a1aa] bg-gray-100 dark:bg-gray-800',
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
  const [isCollapsed, setIsCollapsed] = useState(feedback.isExisting ?? false);

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
      <div className="bg-white dark:bg-[#1f1e24] border border-[#dbdbdb] dark:border-[#404040] rounded-lg overflow-hidden mb-2 animate-in fade-in duration-200 shadow-md hover:shadow-lg transition-shadow">
        <div className="p-2.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor={`description-${feedback.id}`}
              className="block text-[10px] font-bold text-[#444444] dark:text-[#a1a1aa] uppercase tracking-tight"
            >
              {feedback.isNewlyAdded ? 'Add insight' : `Edit: ${feedback.title}`}
            </label>
            <div className="relative" data-dropdown-id={feedback.id}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center space-x-1 text-[10px] text-[#111111] dark:text-[#ececec] font-bold py-0.5 px-1.5 bg-white dark:bg-[#2e2e33] rounded border border-[#dbdbdb] dark:border-[#404040] hover:bg-[#f0f0f0] transition-colors"
              >
                <span className="transform scale-75 opacity-70">
                  {SEVERITY_CONFIG[editedSeverity].icon}
                </span>
                <span className="uppercase tracking-tight">{editedSeverity}</span>
                <ChevronDownIcon />
              </button>
              {isDropdownOpen && (
                <div className="absolute top-full right-0 mt-1 bg-white dark:bg-[#1f1e24] border border-[#dbdbdb] dark:border-[#404040] rounded-lg shadow-xl z-20 min-w-[110px] overflow-hidden">
                  {Object.entries(SEVERITY_CONFIG).map(([severity, config]) => (
                    <button
                      key={severity}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditedSeverity(severity as Severity);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full flex items-center space-x-2 px-2.5 py-1.5 text-[10px] font-bold text-left hover:bg-[#f0f0f0] dark:hover:bg-[#2e2e33] transition-colors ${
                        editedSeverity === severity
                          ? 'text-[#1f75cb] bg-[#1f75cb]/5'
                          : 'text-[#111111] dark:text-[#ececec]'
                      }`}
                    >
                      <span className="transform scale-75 opacity-70">{config.icon}</span>
                      <span className="uppercase">{severity}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <textarea
            id={`description-${feedback.id}`}
            value={editedDescription}
            onChange={(e) => setEditedDescription(e.target.value)}
            placeholder="Write a comment..."
            className="w-full p-2.5 bg-white dark:bg-[#18191d] border border-[#dbdbdb] dark:border-[#404040] text-[#111111] dark:text-[#ececec] text-[12px] font-mono rounded-md focus:outline-none focus:border-[#1f75cb] dark:focus:border-[#428fdc] transition-colors min-h-[60px] resize-none leading-snug"
            rows={2}
          />
        </div>
        <div className="px-2.5 py-1.5 bg-[#fbfbfb] dark:bg-[#2e2e33] flex items-center justify-start border-t border-[#f0f0f0] dark:border-[#404040] rounded-b-lg space-x-2">
          <Button
            variant="success"
            size="sm"
            onClick={handleSave}
            disabled={!editedDescription.trim()}
          >
            Save
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            {feedback.isNewlyAdded ? 'Discard' : 'Cancel'}
          </Button>
        </div>
      </div>
    );
  }

  // If this is an existing comment from GitLab
  if (feedback.isExisting) {
    return (
      <div className="bg-white dark:bg-[#1f1e24] border border-[#dbdbdb] dark:border-[#404040] rounded-lg overflow-hidden mb-2 shadow-md hover:shadow-lg transition-shadow">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full px-2.5 py-2 flex items-center justify-between text-left hover:bg-[#f5f5f5] dark:hover:bg-[#2a2a30] transition-colors"
        >
          <div className="flex items-center space-x-2 min-w-0">
            <div className="flex-shrink-0 mt-0.5 transform scale-75 opacity-70">
              <div className="text-[#444444] dark:text-[#a1a1aa]">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H11.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9Z"
                  />
                </svg>
              </div>
            </div>
            <h3 className="text-[12px] font-bold text-[#111111] dark:text-[#ececec] truncate leading-tight">
              {feedback.title}
            </h3>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-gray-50 dark:bg-gray-800 text-[#444444] dark:text-[#a1a1aa] uppercase tracking-tighter border border-gray-100 dark:border-white/5">
              GitLab
            </span>
            <span
              className={`text-[#444444] dark:text-[#a1a1aa] transform transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
            >
              <svg
                className="w-3 h-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          </div>
        </button>
        {!isCollapsed && (
          <div className="px-2.5 py-2 pt-0">
            <p className="text-[12px] text-[#111111] dark:text-[#ececec] whitespace-pre-wrap leading-tight pl-5">
              {feedback.description}
            </p>
          </div>
        )}
      </div>
    );
  }

  const config = SEVERITY_CONFIG[feedback.severity] || SEVERITY_CONFIG[Severity.Info];

  const isNewComment = !feedback.isExisting;

  return (
    <div
      className={`group transition-all duration-200 bg-white dark:bg-[#1f1e24] rounded-lg overflow-hidden mb-2 shadow-md hover:shadow-lg ${
        isNewComment
          ? 'border-2 border-[#1f75cb] dark:border-[#428fdc]'
          : 'border border-[#dbdbdb] dark:border-[#404040]'
      }`}
    >
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`w-full px-3 py-2.5 flex items-start justify-between text-left hover:bg-[#fafafa] dark:hover:bg-[#252529] transition-colors ${feedback.isIgnored ? 'opacity-50' : ''}`}
      >
        <div className="flex items-start space-x-2.5 min-w-0">
          <div className="flex-shrink-0 mt-0.5 transform scale-90">{config.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-[12px] font-bold text-[#111111] dark:text-[#ececec] truncate leading-tight">
                {feedback.title}
              </h3>
            </div>
            {!isCollapsed && (
              <p className="text-[12px] font-medium text-[#111111] dark:text-[#ececec] whitespace-pre-wrap leading-relaxed">
                {feedback.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2 ml-2">
          {isNewComment && (
            <span className="text-[#db3b21] dark:text-[#db3b21]">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </span>
          )}
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-tight ${config.labelClass}`}
          >
            {feedback.severity}
          </span>
          <span
            className={`text-[#444444] dark:text-[#a1a1aa] transform transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
          >
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </div>
      </button>
      <div
        className={`px-2.5 py-1.5 bg-[#fbfbfb] dark:bg-[#2e2e33] flex items-center justify-between border-t border-[#f0f0f0] dark:border-[#404040] rounded-b-lg ${isCollapsed ? 'hidden' : ''}`}
      >
        {feedback.isIgnored ? (
          <>
            <span className="text-[10px] text-[#444444] dark:text-[#a1a1aa] italic">Ignored</span>
            <Button variant="ghost" size="sm" onClick={() => onToggleIgnoreFeedback(feedback.id)}>
              Undo
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center space-x-3">
              {feedback.status === 'pending' && (
                <div className="flex items-center space-x-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSetEditing(feedback.id, true)}
                    leftIcon={<EditIcon />}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onToggleIgnoreFeedback(feedback.id)}
                    leftIcon={<EyeSlashIcon />}
                  >
                    Ignore
                  </Button>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {feedback.status === 'error' && (
                <p className="text-[10px] font-bold text-[#db3b21] mr-2 uppercase tracking-tighter">
                  {feedback.submissionError}
                </p>
              )}

              {feedback.status === 'pending' && (
                <Button variant="success" size="sm" onClick={handleAction}>
                  Post
                </Button>
              )}
              {feedback.status === 'submitting' && (
                <div className="flex items-center space-x-1.5 text-[10px] font-bold text-[#666666] uppercase tracking-wider">
                  <Spinner size="sm" /> <span>Wait...</span>
                </div>
              )}
              {feedback.status === 'submitted' && (
                <div className="flex items-center space-x-1 text-[11px] text-[#108548] font-bold bg-[#108548]/5 px-2 py-0.5 rounded border border-[#108548]/10">
                  <CheckmarkIcon className="w-3 h-3" />
                  <span className="uppercase tracking-tight text-[10px]">GitLab</span>
                </div>
              )}
              {feedback.status === 'error' && (
                <Button variant="danger" size="sm" onClick={handleAction}>
                  Retry
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
