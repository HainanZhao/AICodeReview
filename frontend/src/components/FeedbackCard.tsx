import type React from 'react';
import { useEffect, useState } from 'react';
import { type ReviewFeedback, Severity } from '../../../types';
import { Spinner } from './Spinner';

const SEVERITY_CONFIG = {
  [Severity.Critical]: {
    bgColor: 'bg-[#ff2a6d]/5',
    textColor: 'text-[#ff2a6d]',
    hexColor: '#ff2a6d',
    label: 'CRITICAL',
  },
  [Severity.Warning]: {
    bgColor: 'bg-[#fcee0a]/5',
    textColor: 'text-[#fcee0a]',
    hexColor: '#fcee0a',
    label: 'WARNING',
  },
  [Severity.Suggestion]: {
    bgColor: 'bg-[#00f0ff]/5',
    textColor: 'text-[#00f0ff]',
    hexColor: '#00f0ff',
    label: 'SUGGESTION',
  },
  [Severity.Info]: {
    bgColor: 'bg-[#05ffa1]/5',
    textColor: 'text-[#05ffa1]',
    hexColor: '#05ffa1',
    label: 'INFO',
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
    const config = SEVERITY_CONFIG[editedSeverity];
    return (
      <div
        className={`cyber-card p-0 relative overflow-hidden mb-2 ${config.bgColor} animate-in fade-in duration-200`}
        style={
          {
            '--card-accent': 'transparent',
            '--cyber-cyan-500': 'transparent',
          } as React.CSSProperties
        }
      >
        <div className="relative z-0">
          <div className="cyber-card__header flex items-center justify-between px-3 py-2 border-b border-[#ececec]/10 bg-white/5">
            <span className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-widest">
              {feedback.isNewlyAdded ? 'NEW COMMENT' : 'EDIT'}
            </span>
            <div className="relative" data-dropdown-id={feedback.id}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center space-x-2 px-2 py-1 text-[10px] font-bold uppercase hover:bg-[#ececec]/10 transition-colors"
              >
                <span className={config.textColor}>{config.label}</span>
                <svg className="w-3 h-3 text-[#a1a1aa]" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              {isDropdownOpen && (
                <div className="absolute top-full right-0 mt-1 bg-[#1a1a24] border border-[#ececec]/20 z-50 min-w-[100px]">
                  {Object.entries(SEVERITY_CONFIG).map(([severity, cfg]) => (
                    <button
                      key={severity}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditedSeverity(severity as Severity);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full flex items-center px-3 py-2 text-[10px] font-bold text-left hover:bg-[#ececec]/10 transition-colors ${
                        editedSeverity === severity ? cfg.textColor : 'text-[#a1a1aa]'
                      }`}
                    >
                      {cfg.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="p-3">
            <textarea
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              placeholder="Enter comment..."
              className="w-full p-2 bg-[#0a0a0f] border border-[#ececec]/20 text-[#ececec] text-[12px] focus:outline-none focus:border-[#00f0ff] transition-all min-h-[60px] resize-none"
              rows={2}
            />
          </div>
          <div className="flex items-center space-x-2 px-3 py-2 border-t border-[#ececec]/10">
            <button
              onClick={handleSave}
              disabled={!editedDescription.trim()}
              className="px-3 py-1 text-[10px] font-bold uppercase bg-[#05ffa1]/20 text-[#05ffa1] hover:bg-[#05ffa1]/30 disabled:opacity-50 transition-colors"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1 text-[10px] font-bold uppercase text-[#a1a1aa] hover:text-[#ececec] transition-colors"
            >
              {feedback.isNewlyAdded ? 'Discard' : 'Cancel'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const config = SEVERITY_CONFIG[feedback.severity] || SEVERITY_CONFIG[Severity.Info];
  return (
    <div
      className={`cyber-card p-0 relative overflow-hidden mb-2 ${config.bgColor} ${feedback.isIgnored ? 'opacity-40' : ''}`}
      style={
        { '--card-accent': 'transparent', '--cyber-cyan-500': 'transparent' } as React.CSSProperties
      }
    >
      <div className="relative z-0">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`w-full px-3 ${isCollapsed ? 'py-1' : 'py-2'} flex items-start justify-between text-left hover:bg-[#ececec]/5 transition-colors`}
        >
          <div className="flex-1 min-w-0">
            <div className={`flex items-center space-x-2 ${isCollapsed ? 'mb-0' : 'mb-1'}`}>
              <span
                className={`text-[9px] font-bold uppercase tracking-widest ${config.textColor}`}
              >
                {config.label}
              </span>
              {feedback.status === 'pending' && (
                <span className="text-[8px] font-bold px-1 py-0.5 bg-[#00f0ff]/20 text-[#00f0ff] uppercase">
                  Pending
                </span>
              )}
              {feedback.status === 'submitted' && (
                <span className="text-[8px] font-bold px-1 py-0.5 bg-[#05ffa1]/20 text-[#05ffa1] uppercase">
                  Posted
                </span>
              )}
            </div>
            <h3
              className={`${isCollapsed ? 'text-[11px]' : 'text-[12px]'} font-bold text-[#ececec] truncate leading-tight`}
            >
              {feedback.title}
            </h3>
            {!isCollapsed && (
              <p className="text-[12px] text-[#a1a1aa] whitespace-pre-wrap leading-relaxed mt-1">
                {feedback.description}
              </p>
            )}
          </div>
          <svg
            className={`w-3 h-3 text-[#a1a1aa] transform transition-transform ml-2 flex-shrink-0 ${isCollapsed ? '' : 'rotate-180'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {!isCollapsed && !feedback.isIgnored && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-[#ececec]/10">
            <div className="flex items-center space-x-3">
              {feedback.status === 'pending' && (
                <>
                  <button
                    onClick={() => onSetEditing(feedback.id, true)}
                    className="text-[10px] font-bold text-[#a1a1aa] hover:text-[#00f0ff] uppercase transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onToggleIgnoreFeedback(feedback.id)}
                    className="text-[10px] font-bold text-[#a1a1aa] hover:text-[#ff2a6d] uppercase transition-colors"
                  >
                    Ignore
                  </button>
                </>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {feedback.status === 'error' && (
                <span className="text-[10px] font-bold text-[#ff2a6d]">
                  {feedback.submissionError}
                </span>
              )}
              {feedback.status === 'pending' && (
                <button
                  onClick={handleAction}
                  className="px-3 py-1 text-[10px] font-bold uppercase bg-[#ff2a6d]/20 text-[#ff2a6d] hover:bg-[#ff2a6d]/30 transition-colors"
                >
                  Post
                </button>
              )}
              {feedback.status === 'submitting' && <Spinner size="sm" />}
            </div>
          </div>
        )}

        {feedback.isIgnored && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-[#ececec]/10">
            <span className="text-[10px] text-[#a1a1aa] italic uppercase">Ignored</span>
            <button
              onClick={() => onToggleIgnoreFeedback(feedback.id)}
              className="text-[10px] font-bold text-[#a1a1aa] hover:text-[#00f0ff] uppercase transition-colors"
            >
              Undo
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
