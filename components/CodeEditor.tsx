import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Spinner } from './Spinner';
import { Config, GitLabProject, GitLabMergeRequest } from '../types';
import { fetchMergeRequestsForProjects } from '../services/gitlabService';
import { loadSelectedProjectIds, saveSelectedProjectIds } from '../services/configService';
import { FilterIcon, BranchIcon } from './icons';

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
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return Math.floor(seconds) + " seconds ago";
};

export const ReviewDashboard: React.FC<ReviewDashboardProps> = ({ onReview, isLoading, config, projects, isLoadingProjects }) => {
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
                const fetchedMrs = await fetchMergeRequestsForProjects(config, projects, selectedProjectIds);
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
            ? selectedProjectIds.filter(id => id !== projectId)
            : [...selectedProjectIds, projectId];
        setSelectedProjectIds(newSelection);
        saveSelectedProjectIds(newSelection);
    };
    
    const filteredProjects = useMemo(() => {
        return projects.filter(p => p.name_with_namespace.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [projects, searchTerm]);

    const handleUrlSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (mrUrlInput.trim()) {
            onReview(mrUrlInput.trim());
        }
    };


  return (
    <div className="bg-white dark:bg-brand-surface rounded-lg shadow-xl h-full flex flex-col">
       <div className="p-4 border-b border-gray-200 dark:border-brand-primary flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Review Dashboard</h2>
        <div className="relative" ref={filterRef}>
            <button onClick={() => setIsFilterOpen(!isFilterOpen)} className="flex items-center space-x-2 text-sm bg-gray-100 dark:bg-brand-primary hover:bg-gray-200 dark:hover:bg-brand-secondary text-gray-800 dark:text-white font-semibold py-2 px-3 rounded-md transition-colors">
                <FilterIcon />
                <span>Filter Projects</span>
                <span className="bg-brand-secondary text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">{selectedProjectIds.length > 0 ? selectedProjectIds.length : '0'}</span>
            </button>
            {isFilterOpen && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-brand-bg border border-gray-200 dark:border-brand-primary rounded-lg shadow-2xl z-20">
                    <div className="p-2">
                         <input
                            type="text"
                            placeholder="Search projects..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full p-2 bg-gray-100 dark:bg-brand-primary border border-gray-300 dark:border-brand-primary/50 text-gray-800 dark:text-brand-text text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                        />
                    </div>
                    <div className="max-h-60 overflow-y-auto p-2">
                        {isLoadingProjects ? <div className="p-4 text-center"><Spinner size="md" /></div> :
                            filteredProjects.map(project => (
                                <label key={project.id} className="flex items-center space-x-3 p-2 hover:bg-gray-100 dark:hover:bg-brand-primary rounded-md cursor-pointer">
                                    <input type="checkbox" checked={selectedProjectIds.includes(project.id)} onChange={() => handleProjectSelectionChange(project.id)} className="form-checkbox h-4 w-4 bg-gray-200 dark:bg-brand-primary border-gray-300 dark:border-brand-subtle text-brand-secondary focus:ring-brand-secondary" />
                                    <span className="text-sm text-gray-800 dark:text-brand-text">{project.name_with_namespace}</span>
                                </label>
                            ))
                        }
                    </div>
                </div>
            )}
        </div>
      </div>
      <div className="p-4 border-b border-gray-200 dark:border-brand-primary">
          <form onSubmit={handleUrlSubmit}>
              <label htmlFor="mr-url-input" className="block text-sm font-medium text-gray-600 dark:text-brand-subtle mb-2">
                  Review by URL
              </label>
              <div className="flex space-x-2">
                  <input
                      id="mr-url-input"
                      type="url"
                      value={mrUrlInput}
                      onChange={(e) => setMrUrlInput(e.target.value)}
                      placeholder="Paste Merge Request URL..."
                      className="flex-grow p-2 bg-gray-100 dark:bg-brand-primary border border-gray-300 dark:border-brand-primary/50 text-gray-800 dark:text-brand-text text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-brand-secondary disabled:opacity-50"
                      disabled={isLoading}
                      aria-label="Merge Request URL"
                  />
                  <button
                      type="submit"
                      disabled={!mrUrlInput.trim() || isLoading}
                      className="bg-brand-secondary hover:bg-red-600 disabled:bg-gray-300 dark:disabled:bg-brand-primary disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md transition-all duration-300"
                  >
                      Review
                  </button>
              </div>
          </form>
      </div>
      <div className="flex-grow overflow-y-auto">
        {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <Spinner size="lg" />
                <p className="mt-4 text-lg text-gray-500 dark:text-brand-subtle">Analyzing Merge Request...</p>
            </div>
        ) : (
            <div className="p-4">
                {error && <div className="text-center text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-4 rounded-lg mb-4"><h3 className="font-bold">An Error Occurred</h3><p>{error}</p></div>}
                <h3 className="text-md font-semibold text-gray-500 dark:text-brand-subtle mb-3">Or Select from List</h3>
                {isLoadingMrs ? <div className="pt-10 text-center"><Spinner size="lg" /></div> :
                    mergeRequests.length > 0 ? (
                        <ul className="space-y-3">
                            {mergeRequests.map(mr => (
                                <li key={mr.web_url} onClick={() => onReview(mr.web_url)} className="bg-gray-100/50 dark:bg-brand-primary/40 hover:bg-gray-100 dark:hover:bg-brand-primary/80 p-4 rounded-lg cursor-pointer transition-colors group">
                                    <p className="font-semibold text-gray-800 dark:text-brand-text group-hover:text-brand-secondary dark:group-hover:text-brand-secondary transition-colors">{mr.title}</p>
                                    <div className="text-xs text-gray-500 dark:text-brand-subtle mt-2 flex items-center justify-between">
                                        <div className='truncate pr-2'>
                                            <span>!{mr.iid} in {mr.project_name} by @{mr.author.name}</span>
                                        </div>
                                        <span>{timeAgo(mr.updated_at)}</span>
                                    </div>
                                    <div className="flex items-center text-sm font-mono bg-white/50 dark:bg-brand-surface/50 p-2 mt-3 rounded-md text-xs">
                                        <BranchIcon />
                                        <span className="ml-2 bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 px-2 py-1 rounded-full truncate">{mr.source_branch}</span>
                                        <span className="text-gray-500 dark:text-brand-subtle mx-2">→</span>
                                        <span className="bg-gray-200 dark:bg-gray-500/20 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-full truncate">{mr.target_branch}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-center py-10">
                            <p className="text-gray-500 dark:text-brand-subtle">
                                {selectedProjectIds.length > 0 ? "No open merge requests found for the selected projects." : "Select projects to see open merge requests."}
                            </p>
                        </div>
                    )
                }
            </div>
        )}
      </div>
    </div>
  );
};