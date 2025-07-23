import React, { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Header } from './components/Header';
import { ReviewDashboard } from './components/CodeEditor';
import { FeedbackPanel } from './components/FeedbackPanel';
import { reviewCode, fetchMrDetails } from './services/aiReviewService';
import { fetchProjects, postDiscussion, approveMergeRequest } from './services/gitlabService';
import { ReviewFeedback, Config, GitLabMRDetails, GitLabProject, ParsedFileDiff, ParsedDiffLine, GitLabPosition, Severity, ParsedHunk } from './types';
import { ConfigModal } from './components/ConfigModal';
import { loadConfig, loadTheme, saveTheme, loadProjectsFromCache, saveProjectsToCache } from './services/configService';
import { MrSummary } from './components/MrSummary';



function App() {
  const [feedback, setFeedback] = useState<ReviewFeedback[] | null>(null);
  const [mrDetails, setMrDetails] = useState<GitLabMRDetails | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [projects, setProjects] = useState<GitLabProject[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState<boolean>(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const savedTheme = loadTheme();
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    setTheme(initialTheme);
     if (initialTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  useEffect(() => {
    const loadedConfig = loadConfig();
    if (loadedConfig && loadedConfig.gitlabUrl && loadedConfig.accessToken) {
      setConfig(loadedConfig);
    } else {
      setIsConfigModalOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!config) {
        setIsLoadingProjects(false);
        return;
    }

    const loadProjects = async () => {
        const cachedProjects = loadProjectsFromCache();
        if (cachedProjects) {
            setProjects(cachedProjects);
            setIsLoadingProjects(false);
        }

        try {
            setIsLoadingProjects(true);
            const fetchedProjects = await fetchProjects(config);
            setProjects(fetchedProjects);
            saveProjectsToCache(fetchedProjects);
        } catch (err) {
            console.error("Failed to load projects in App.tsx", err);
            if (!cachedProjects) { // Only set empty if no cache was loaded
                setProjects([]);
            }
        } finally {
            setIsLoadingProjects(false);
        }
    };
    loadProjects();
  }, [config]);


  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);

    type FeedbackUpdate = (prev: ReviewFeedback[] | null) => ReviewFeedback[];


  const handleReviewRequest = useCallback(async (url: string) => {
    if (!url.trim()) {
      setError("Cannot start review with an empty URL.");
      return;
    }
    if (!config) {
      setError("GitLab configuration is missing. Please set it in the settings.");
      setIsConfigModalOpen(true);
      return;
    }

    setIsLoading(true);
    setError(null);
    setFeedback(null);
    setMrDetails(null);
    setIsAiAnalyzing(false);

    try {
      const result = await fetchMrDetails(url, config);
      if (!result?.mrDetails) {
        throw new Error("Failed to fetch merge request details");
      }

      // Set MR details and show existing comments immediately
      setMrDetails(result.mrDetails);
      setFeedback(result.feedback || []); // Show existing comments right away
      setIsLoading(false);

      // Then start AI review
      setIsAiAnalyzing(true);
      const { feedback: aiReviewResult } = await reviewCode(result.mrDetails, config);

      // Deduplicate feedback by id (or by content if needed)
      const existingFeedback = result.feedback || [];
      const aiFeedback = aiReviewResult || [];
      const seen = new Set();
      const dedupedFeedback = [...existingFeedback, ...aiFeedback].filter(fb => {
        const key = fb.id || (fb.filePath + ':' + fb.lineNumber + ':' + fb.title);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setFeedback(() => dedupedFeedback);
      setIsAiAnalyzing(false);
    } catch(error) {
      console.error('Error fetching MR details:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
      setIsLoading(false);
      setIsAiAnalyzing(false);
    }
  }, [config]);

  const handleSaveConfig = (newConfig: Config) => {
    setConfig(newConfig);
    setError(null);
  };
  
  const handlePostComment = useCallback(async (feedbackId: string) => {
    if (!config || !mrDetails || !feedback) return;

    const feedbackItem = feedback.find(f => f.id === feedbackId);
    if (!feedbackItem || feedbackItem.status !== 'pending' || feedbackItem.isEditing) return;

    setFeedback(prev => prev!.map(f => f.id === feedbackId ? { ...f, status: 'submitting' } : f));

    try {
        await postDiscussion(config, mrDetails, feedbackItem);
        setFeedback(prev => prev!.map(f => f.id === feedbackId ? { ...f, status: 'submitted' } : f));
    } catch(err) {
        console.error("Failed to post comment:", err);
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setFeedback(prev => prev!.map(f => f.id === feedbackId ? { ...f, status: 'error', submissionError: errorMessage } : f));
    }
  }, [config, mrDetails, feedback]);

  const handlePostAllComments = useCallback(async () => {
    if (!feedback) return;
    const pendingFeedback = feedback.filter(f => f.status === 'pending' && !f.isEditing && !f.isIgnored);
    for (const item of pendingFeedback) {
        await handlePostComment(item.id);
    }
  }, [feedback, handlePostComment]);

  const handleNewReview = useCallback(() => {
    setFeedback(null);
    setMrDetails(null);
    setError(null);
  }, []);

  const handleThemeToggle = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    saveTheme(newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleSetEditing = useCallback((feedbackId: string, isEditing: boolean) => {
    setFeedback(prev => prev!.map(f => f.id === feedbackId ? { ...f, isEditing } : f));
  }, []);

  const handleDeleteFeedback = useCallback((feedbackId: string) => {
      setFeedback(prev => prev!.filter(f => f.id !== feedbackId));
  }, []);

  const handleUpdateFeedback = useCallback((id: string, title: string, description: string, severity: Severity) => {
      setFeedback(prev => prev!.map(f =>
          f.id === id
              ? { ...f, title, description, severity, isEditing: false, isNewlyAdded: false }
              : f
      ));
  }, []);

  const handleApproveMR = useCallback(async () => {
    if (!config || !mrDetails) return;
    await approveMergeRequest(config, mrDetails.projectId, mrDetails.mrIid);
  }, [config, mrDetails]);

  const handleRedoReview = useCallback(async () => {
    if (!config || !mrDetails || isAiAnalyzing) return;
    
    setIsAiAnalyzing(true);
    setError(null);
    
    try {
      const { feedback: aiReviewResult } = await reviewCode(mrDetails, config);
      
      // Combine existing GitLab comments with new AI review comments
      const combinedFeedback = [...(mrDetails.existingFeedback || []), ...aiReviewResult];
      
      setFeedback(() => combinedFeedback);
    } catch (error) {
      console.error('Error during redo review:', error);
      setError(error instanceof Error ? error.message : 'An error occurred during review');
    } finally {
      setIsAiAnalyzing(false);
    }
  }, [config, mrDetails, isAiAnalyzing]);

  const handleToggleIgnoreFeedback = useCallback((feedbackId: string) => {
    setFeedback(prev => prev!.map(f =>
        f.id === feedbackId ? { ...f, isIgnored: !f.isIgnored } : f
    ));
  }, []);

  const handleAddCustomFeedback = useCallback((fileDiff: ParsedFileDiff, line: ParsedDiffLine) => {
      if (!mrDetails) return;

      if (line.type === 'remove' || line.type === 'meta') {
          return;
      }

      let position: GitLabPosition | null = null;
      let positionPayload: { old_line?: number; new_line?: number } = {};

      if (line.type === 'add' && line.newLine) {
          positionPayload = { new_line: line.newLine };
      } else if (line.type === 'context' && line.oldLine && line.newLine) {
          positionPayload = { old_line: line.oldLine, new_line: line.newLine };
      }

      if (line.newLine && Object.keys(positionPayload).length > 0) {
          position = {
              base_sha: mrDetails.base_sha,
              start_sha: mrDetails.start_sha,
              head_sha: mrDetails.head_sha,
              position_type: 'text',
              old_path: fileDiff.oldPath,
              new_path: fileDiff.filePath,
              ...positionPayload
          };
      }

      const newFeedback: ReviewFeedback = {
          id: uuidv4(),
          lineNumber: line.newLine || 0,
          severity: Severity.Suggestion,
          title: 'Manual Suggestion',
          description: '',
          filePath: fileDiff.filePath,
          lineContent: line.content,
          position,
          status: 'pending',
          isEditing: true,
          isNewlyAdded: true,
          isIgnored: false,
      };

      setFeedback(prev => {
          if (!prev) return [newFeedback];
          const otherFeedback = prev.filter(f => f.isEditing === false);
          return [...otherFeedback, newFeedback];
      });

  }, [mrDetails]);

  const handleToggleHunkCollapse = useCallback((filePath: string, hunkIndex: number) => {
    setMrDetails(prevDetails => {
        if (!prevDetails) return null;

        const newParsedDiffs = prevDetails.parsedDiffs.map(fileDiff => {
            if (fileDiff.filePath === filePath) {
                const newHunks = fileDiff.hunks.map((hunk, index) => {
                    if (index === hunkIndex) {
                        return { ...hunk, isCollapsed: !hunk.isCollapsed };
                    }
                    return hunk;
                });
                return { ...fileDiff, hunks: newHunks };
            }
            return fileDiff;
        });

        return { ...prevDetails, parsedDiffs: newParsedDiffs };
    });
  }, []);

  const handleExpandHunkContext = useCallback((filePath: string, hunkIndex: number, direction: 'up' | 'down', linesToExpand: number) => {
      setMrDetails(prevDetails => {
          if (!prevDetails) return null;

          const newDetails = JSON.parse(JSON.stringify(prevDetails));
          const fileDiff = newDetails.parsedDiffs.find((f: ParsedFileDiff) => f.filePath === filePath);
          if (!fileDiff) return prevDetails;

          const hunk = fileDiff.hunks[hunkIndex];
          if (!hunk) return prevDetails;

          const fileContents = newDetails.fileContents[filePath];
          if (!fileContents) return prevDetails;

          if (direction === 'up') {
              const oldFileContent = fileContents.oldContent || [];
              const newFileContent = fileContents.newContent || [];

              const targetOldStart = Math.max(1, hunk.oldStartLine - linesToExpand);
              const targetNewStart = Math.max(1, hunk.newStartLine - linesToExpand);
              const actualOldLinesToAdd = hunk.oldStartLine - targetOldStart;
              const actualNewLinesToAdd = hunk.newStartLine - targetNewStart;
              
              const newLines: ParsedDiffLine[] = [];
              for (let i = 0; i < actualNewLinesToAdd; i++) {
                  const newLineNum = targetNewStart + i;
                  const oldLineNum = targetOldStart + i;
                  // In pure context expansion, old and new content should be the same.
                  // We prioritize new file content if available.
                  const content = newFileContent[newLineNum - 1] ?? oldFileContent[oldLineNum - 1] ?? '';
                  newLines.push({ type: 'context', content: content, oldLine: oldLineNum, newLine: newLineNum });
              }

              hunk.lines = [...newLines, ...hunk.lines];
              hunk.oldStartLine = targetOldStart;
              hunk.newStartLine = targetNewStart;
              hunk.oldLineCount += actualOldLinesToAdd;
              hunk.newLineCount += actualNewLinesToAdd;

          } else { // direction 'down'
              const oldFileContent = fileContents.oldContent || [];
              const newFileContent = fileContents.newContent || [];

              const lastLine = hunk.lines[hunk.lines.length - 1];
              const currentOldEnd = (lastLine.oldLine || hunk.oldStartLine + hunk.oldLineCount -1);
              const currentNewEnd = (lastLine.newLine || hunk.newStartLine + hunk.newLineCount -1);
              
              const targetOldEnd = Math.min(oldFileContent.length, currentOldEnd + linesToExpand);
              const targetNewEnd = Math.min(newFileContent.length, currentNewEnd + linesToExpand);

              const actualOldLinesToAdd = targetOldEnd - currentOldEnd;
              const actualNewLinesToAdd = targetNewEnd - currentNewEnd;

              const newLines: ParsedDiffLine[] = [];
              for (let i = 1; i <= actualNewLinesToAdd; i++) {
                  const newLineNum = currentNewEnd + i;
                  const oldLineNum = currentOldEnd + i;
                  const content = newFileContent[newLineNum - 1] ?? oldFileContent[oldLineNum - 1] ?? '';
                  newLines.push({ type: 'context', content: content, oldLine: oldLineNum, newLine: newLineNum });
              }
              hunk.lines = [...hunk.lines, ...newLines];
              hunk.oldLineCount += actualOldLinesToAdd;
              hunk.newLineCount += actualNewLinesToAdd;
          }
          // Regenerate header
          hunk.header = `@@ -${hunk.oldStartLine},${hunk.oldLineCount} +${hunk.newStartLine},${hunk.newLineCount} @@`;
          
          // A bit of a hack to get the fileContents Map to serialize and deserialize
          newDetails.fileContents = new Map(Object.entries(newDetails.fileContents));
          return newDetails;
      });
  }, []);

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Header 
        onOpenSettings={() => setIsConfigModalOpen(true)}
        onToggleTheme={handleThemeToggle}
        currentTheme={theme}
      />
      <ConfigModal 
        isOpen={isConfigModalOpen} 
        onClose={() => setIsConfigModalOpen(false)}
        onSave={handleSaveConfig}
        initialConfig={config}
      />
      <main className="flex-grow w-full px-2 md:px-4 lg:px-4 py-2 md:py-3 lg:py-3 grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className={`flex flex-col ${mrDetails ? 'lg:col-span-3' : 'lg:col-span-4'}`}>
          {mrDetails ? (
            <MrSummary mrDetails={mrDetails} onNewReview={handleNewReview} />
          ) : (
            <ReviewDashboard 
                onReview={handleReviewRequest} 
                isLoading={isLoading} 
                config={config} 
                projects={projects}
                isLoadingProjects={isLoadingProjects}
            />
          )}
        </div>
        <div className={`flex flex-col ${mrDetails ? 'lg:col-span-9' : 'lg:col-span-8'}`}>
          <FeedbackPanel 
            feedback={feedback}
            mrDetails={mrDetails}
            isLoading={isLoading} 
            error={error} 
            onPostComment={handlePostComment}
            onPostAllComments={handlePostAllComments}
            onUpdateFeedback={handleUpdateFeedback}
            onDeleteFeedback={handleDeleteFeedback}
            onSetEditing={handleSetEditing}
            onAddCustomFeedback={handleAddCustomFeedback}
            onToggleHunkCollapse={handleToggleHunkCollapse}
            onExpandHunkContext={handleExpandHunkContext}
            onToggleIgnoreFeedback={handleToggleIgnoreFeedback}
            isAiAnalyzing={isAiAnalyzing}
            onApproveMR={handleApproveMR}
            onRedoReview={handleRedoReview}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
