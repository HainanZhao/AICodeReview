import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { loadSelectedProjectIds, saveSelectedProjectIds } from '../services/configService';
import { fetchMergeRequestsForProjects } from '../services/gitlabService';
import type { Config, GitLabMergeRequest, GitLabProject } from '../types';
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
  if (interval > 1) return `${Math.floor(interval)}y ago`;
  interval = seconds / 2592000;
  if (interval > 1) return `${Math.floor(interval)}mo ago`;
  interval = seconds / 86400;
  if (interval > 1) return `${Math.floor(interval)}d ago`;
  interval = seconds / 3600;
  if (interval > 1) return `${Math.floor(interval)}h ago`;
  interval = seconds / 60;
  if (interval > 1) return `${Math.floor(interval)}m ago`;
  return `${Math.floor(seconds)}s ago`;
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
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-[#ececec]/10 flex justify-between items-center">
        <h2 className="text-sm font-bold text-[#ececec]">Dashboard</h2>
        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="flex items-center space-x-2 px-2 py-1 text-[11px] font-bold text-[#a1a1aa] hover:text-[#00f0ff] transition-colors"
          >
            <FilterIcon className="w-3.5 h-3.5" />
            <span>Projects</span>
            <span className="bg-[#00f0ff]/20 text-[#00f0ff] text-[10px] px-1.5">
              {selectedProjectIds.length}
            </span>
          </button>
          {isFilterOpen && (
            <div className="absolute top-full right-0 mt-1 w-72 bg-[#1a1a24] border border-[#ececec]/10 z-50">
              <div className="p-2 border-b border-[#ececec]/10">
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full p-2 bg-transparent text-[11px] text-[#ececec] focus:outline-none"
                />
              </div>
              <div className="max-h-48 overflow-y-auto p-1">
                {isLoadingProjects ? (
                  <div className="p-4 text-center">
                    <Spinner size="sm" />
                  </div>
                ) : (
                  filteredProjects.map((project) => (
                    <label
                      key={project.id}
                      className="flex items-center space-x-2 p-2 hover:bg-[#ececec]/5 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedProjectIds.includes(project.id)}
                        onChange={() => handleProjectSelectionChange(project.id)}
                        className="h-3 w-3 border-[#ececec]/30 text-[#00f0ff] bg-transparent"
                      />
                      <span className="text-[11px] text-[#a1a1aa] truncate">
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

      <div className="px-4 py-3 border-b border-[#ececec]/10">
        <form onSubmit={handleUrlSubmit}>
          <div className="flex space-x-2">
            <input
              id="mr-url-input"
              type="url"
              value={mrUrlInput}
              onChange={(e) => setMrUrlInput(e.target.value)}
              placeholder="Paste MR URL..."
              className="flex-grow px-3 py-2 bg-transparent text-[11px] text-[#ececec] focus:outline-none border border-[#ececec]/10 focus:border-[#00f0ff]/50 transition-colors"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!mrUrlInput.trim() || isLoading}
              className="px-4 py-2 text-[11px] font-bold bg-[#00f0ff]/10 text-[#00f0ff] hover:bg-[#00f0ff]/20 disabled:opacity-50 transition-colors"
            >
              Review
            </button>
          </div>
        </form>
      </div>

      <div className="flex-grow overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Spinner size="lg" />
            <p className="mt-4 text-[11px] text-[#a1a1aa]">Analyzing...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {error && (
              <div className="text-center p-3 bg-[#ff2a6d]/10 text-[#ff2a6d] text-[11px]">
                {error}
              </div>
            )}

            <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#a1a1aa] mb-2">
              Open Merge Requests
            </h3>

            {isLoadingMrs ? (
              <div className="py-8 text-center">
                <Spinner size="md" />
              </div>
            ) : mergeRequests.length > 0 ? (
              <ul className="space-y-2">
                {mergeRequests.map((mr) => (
                  <li
                    key={mr.web_url}
                    onClick={() => onReview(mr.web_url)}
                    className="p-3 cursor-pointer hover:bg-[#ececec]/5 transition-colors border-l-2 border-transparent hover:border-[#00f0ff]"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-bold text-[#ececec] text-[12px] leading-tight">
                        {mr.title}
                      </h4>
                      <span className="text-[10px] text-[#a1a1aa] whitespace-nowrap ml-2">
                        {timeAgo(mr.updated_at)}
                      </span>
                    </div>

                    <div className="flex items-center text-[10px] text-[#a1a1aa] mb-2">
                      <span className="text-[#00f0ff] mr-2">!{mr.iid}</span>
                      <span className="truncate">{mr.project_name}</span>
                      <span className="mx-2 opacity-30">·</span>
                      <span className="text-[#ff2a6d]">@{mr.author.name}</span>
                    </div>

                    <div className="flex items-center text-[10px] text-[#a1a1aa]">
                      <BranchIcon className="w-3 h-3 mr-1 opacity-60" />
                      <span className="text-[#00f0ff] truncate max-w-[100px]">
                        {mr.source_branch}
                      </span>
                      <span className="mx-1">→</span>
                      <span className="truncate max-w-[100px]">{mr.target_branch}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-8 text-[11px] text-[#a1a1aa]">
                {selectedProjectIds.length > 0
                  ? 'No merge requests found'
                  : 'Select projects to view merge requests'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
