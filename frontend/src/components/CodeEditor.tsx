import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { loadSelectedProjectIds, saveSelectedProjectIds } from '../services/configService';
import { fetchMergeRequestsForProjects } from '../services/gitlabService';
import type { Config, GitLabMergeRequest, GitLabProject } from '../types';
import { Button } from './Button';
import { Spinner } from './Spinner';
import { BranchIcon, FilterIcon } from './icons';

interface ReviewDashboardProps {
  onReview: (url: string) => void;
  isLoading: boolean;
  config: Config | null;
  projects: GitLabProject[];
  isLoadingProjects: boolean;
}

const timeAgo = (date: string) => {
  const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return `${Math.floor(interval)} years ago`;
  interval = seconds / 2592000;
  if (interval > 1) return `${Math.floor(interval)} months ago`;
  interval = seconds / 86400;
  if (interval > 1) return `${Math.floor(interval)} days ago`;
  interval = seconds / 3600;
  if (interval > 1) return `${Math.floor(interval)} hours ago`;
  interval = seconds / 60;
  if (interval > 1) return `${Math.floor(interval)} minutes ago`;
  return `${Math.floor(seconds)} seconds ago`;
};

export const ReviewDashboard: React.FC<ReviewDashboardProps> = ({
  onReview,
  isLoading,
  config,
  projects,
  isLoadingProjects,
}) => {
  const [mrUrlInput, setMrUrlInput] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);
  const [mergeRequests, setMergeRequests] = useState<GitLabMergeRequest[]>([]);
  const [isLoadingMrs, setIsLoadingMrs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedProjectIds = loadSelectedProjectIds();
    if (savedProjectIds) {
      setSelectedProjectIds(savedProjectIds);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };

    if (isFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterOpen]);

  useEffect(() => {
    if (!config || selectedProjectIds.length === 0) {
      setMergeRequests([]);
      return;
    }

    const fetchMrs = async () => {
      setIsLoadingMrs(true);
      setError(null);
      try {
        const fetchedMrs = await fetchMergeRequestsForProjects(
          config,
          projects,
          selectedProjectIds
        );
        setMergeRequests(fetchedMrs);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch merge requests.');
      } finally {
        setIsLoadingMrs(false);
      }
    };

    if (projects.length > 0) {
      fetchMrs();
    }
  }, [config, selectedProjectIds, projects]);

  const handleProjectSelectionChange = (projectId: number) => {
    const newSelection = selectedProjectIds.includes(projectId)
      ? selectedProjectIds.filter((id) => id !== projectId)
      : [...selectedProjectIds, projectId];
    setSelectedProjectIds(newSelection);
    saveSelectedProjectIds(newSelection);
  };

  const filteredProjects = useMemo(() => {
    return projects.filter((p) =>
      p.name_with_namespace.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [projects, searchTerm]);

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mrUrlInput.trim()) {
      onReview(mrUrlInput.trim());
    }
  };

  return (
    <div className="bg-white dark:bg-[#18191d] rounded-md shadow-sm h-full flex flex-col border border-[#dbdbdb] dark:border-[#404040] overflow-hidden">
      <div className="p-4 border-b border-[#dbdbdb] dark:border-[#404040] bg-[#fbfbfb] dark:bg-[#1f1e24] flex justify-between items-center">
        <div>
          <h2 className="text-[13px] font-bold text-[#111111] dark:text-[#ececec] tracking-tight">
            Review Dashboard
          </h2>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#444444] dark:text-[#a1a1aa] mt-0.5">
            Project Overview
          </p>
        </div>
        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="flex items-center space-x-2 text-[11px] font-bold bg-white dark:bg-[#2e2e33] border border-[#dbdbdb] dark:border-[#404040] hover:bg-[#f0f0f0] dark:hover:bg-[#404040] text-[#111111] dark:text-[#ececec] py-1.5 px-3 rounded shadow-sm transition-all"
          >
            <FilterIcon className="w-3.5 h-3.5" />
            <span>Filter</span>
            <span className="bg-[#1f75cb] text-white text-[10px] font-bold rounded px-1.5 py-0.5 ml-1">
              {selectedProjectIds.length}
            </span>
          </button>
          {isFilterOpen && (
            <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-[#1f1e24] border border-[#dbdbdb] dark:border-[#404040] rounded shadow-lg z-30">
              <div className="p-3 border-b border-[#dbdbdb] dark:border-[#404040]">
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full p-2 bg-white dark:bg-[#18191d] border border-[#dbdbdb] dark:border-[#404040] text-[#111111] dark:text-[#ececec] text-xs rounded focus:outline-none focus:border-[#1f75cb]"
                />
              </div>
              <div className="max-h-64 overflow-y-auto p-2 scrollbar-thin">
                {isLoadingProjects ? (
                  <div className="p-6 text-center">
                    <Spinner size="md" />
                  </div>
                ) : (
                  filteredProjects.map((project) => (
                    <label
                      key={project.id}
                      className="flex items-center space-x-3 p-2 hover:bg-[#f0f0f0] dark:hover:bg-[#2e2e33] rounded cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedProjectIds.includes(project.id)}
                        onChange={() => handleProjectSelectionChange(project.id)}
                        className="form-checkbox h-4 w-4 rounded border-[#dbdbdb] dark:border-[#404040] text-[#1f75cb] focus:ring-[#1f75cb]"
                      />
                      <span className="text-xs font-medium text-[#111111] dark:text-[#ececec]">
                        {project.name_with_namespace}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="p-4 border-b border-[#dbdbdb] dark:border-[#404040] bg-white dark:bg-[#18191d]">
        <form onSubmit={handleUrlSubmit}>
          <div className="flex space-x-2">
            <input
              id="mr-url-input"
              type="url"
              value={mrUrlInput}
              onChange={(e) => setMrUrlInput(e.target.value)}
              placeholder="Paste Merge Request URL..."
              className="flex-grow px-3 py-2 bg-white dark:bg-[#18191d] border border-[#dbdbdb] dark:border-[#404040] text-[#111111] dark:text-[#ececec] text-[12px] rounded focus:outline-none focus:border-[#1f75cb] transition-all"
              disabled={isLoading}
            />
            <Button
              type="submit"
              variant="success"
              size="sm"
              disabled={!mrUrlInput.trim() || isLoading}
            >
              Review
            </Button>
          </div>
        </form>
      </div>
      <div className="flex-grow overflow-y-auto p-4 bg-white dark:bg-[#18191d]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-10 opacity-60">
            <Spinner size="lg" />
            <p className="mt-4 text-[11px] font-bold uppercase tracking-widest text-[#444444] dark:text-[#a1a1aa]">
              Analyzing...
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="text-center bg-[#db3b21]/10 border border-[#db3b21]/20 p-3 rounded mb-4">
                <h3 className="font-bold text-[11px] text-[#db3b21] uppercase tracking-wider mb-1">
                  Error
                </h3>
                <p className="text-[11px] text-[#db3b21]">{error}</p>
              </div>
            )}

            <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#444444] dark:text-[#a1a1aa]">
              Open Merge Requests
            </h3>

            {isLoadingMrs ? (
              <div className="py-12 text-center opacity-40">
                <Spinner size="lg" />
              </div>
            ) : mergeRequests.length > 0 ? (
              <ul className="space-y-2">
                {mergeRequests.map((mr) => (
                  <li
                    key={mr.web_url}
                    onClick={() => onReview(mr.web_url)}
                    className="bg-white dark:bg-[#1f1e24] border border-[#dbdbdb] dark:border-[#404040] hover:border-[#1f75cb] dark:hover:border-[#428fdc] p-3 rounded cursor-pointer transition-all group"
                  >
                    <div className="flex justify-between items-start mb-1.5">
                      <h4 className="font-bold text-[#111111] dark:text-[#ececec] group-hover:text-[#1f75cb] dark:group-hover:text-[#428fdc] transition-colors text-[13px] leading-tight">
                        {mr.title}
                      </h4>
                      <span className="text-[10px] font-bold text-[#444444] dark:text-[#a1a1aa] tabular-nums whitespace-nowrap ml-2">
                        {timeAgo(mr.updated_at)}
                      </span>
                    </div>

                    <div className="flex items-center text-[11px] font-semibold text-[#444444] dark:text-[#a1a1aa] mb-2.5">
                      <span className="bg-[#f0f0f0] dark:bg-[#2e2e33] px-1.5 py-0.5 rounded border border-[#dbdbdb] dark:border-[#404040] mr-2 font-bold tracking-tight">
                        !{mr.iid}
                      </span>
                      <span className="truncate">{mr.project_name}</span>
                      <span className="mx-1.5 opacity-30">•</span>
                      <span>@{mr.author.name}</span>
                    </div>

                    <div className="flex items-center text-[10px] font-mono bg-[#fbfbfb] dark:bg-[#18191d] p-1.5 rounded border border-[#dbdbdb] dark:border-[#404040]">
                      <BranchIcon className="w-3 h-3 text-[#444444] dark:text-[#a1a1aa]" />
                      <span className="ml-1.5 text-[#1f75cb] dark:text-[#428fdc] font-bold truncate max-w-[100px]">
                        {mr.source_branch}
                      </span>
                      <span className="text-[#444444] dark:text-[#a1a1aa] mx-1.5">→</span>
                      <span className="text-[#444444] dark:text-[#a1a1aa] font-medium truncate max-w-[100px]">
                        {mr.target_branch}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-12 opacity-40">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#444444] dark:text-[#a1a1aa]">
                  {selectedProjectIds.length > 0
                    ? 'No open merge requests'
                    : 'Select projects to begin'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
