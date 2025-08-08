import React, { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Header } from './components/Header';
import { ReviewDashboard } from './components/CodeEditor';
import { FeedbackPanel } from './components/FeedbackPanel';
import { SyntaxHighlightingDemo } from './components/SyntaxHighlightingDemo';
import { fetchMrDetailsOnly, runAiReview } from './services/aiReviewService';
import { fetchProjects, postDiscussion, approveMergeRequest } from './services/gitlabService';
import {
  ReviewFeedback,
  GitLabMRDetails,
  GitLabProject,
  ParsedFileDiff,
  GitLabPosition,
  Severity,
} from '../../types';
import { Config, ParsedDiffLine } from './types';
import { ConfigModal } from './components/ConfigModal';
import { ResizablePane } from './components/ResizablePane';
import {
  loadConfig,
  loadTheme,
  saveTheme,
  loadProjectsFromCache,
  saveProjectsToCache,
  fetchBackendConfig,
  type ConfigSource,
} from './services/configService';
import { MrSummary } from './components/MrSummary';

function App() {
  const [feedback, setFeedback] = useState<ReviewFeedback[] | null>(null);
  const [mrDetails, setMrDetails] = useState<GitLabMRDetails | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [configSource, setConfigSource] = useState<ConfigSource>('none');
  const [backendConfig, setBackendConfig] = useState<{
    url?: string;
    hasAccessToken?: boolean;
    configSource?: string;
  } | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [projects, setProjects] = useState<GitLabProject[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState<boolean>(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [showSyntaxDemo, setShowSyntaxDemo] = useState<boolean>(false);

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
    const loadConfiguration = async () => {
      try {
        // First, check localStorage config (highest priority)
        const localConfig = loadConfig();

        if (localConfig && localConfig.url && localConfig.accessToken) {
          // User has localStorage config - use it (user override)
          setConfig(localConfig);
          setConfigSource('localStorage');

          // Still fetch backend config for comparison/reset functionality
          try {
            const fetchedBackendConfig = await fetchBackendConfig();
            setBackendConfig(fetchedBackendConfig);
          } catch (error) {
            console.warn('Failed to fetch backend config for comparison:', error);
          }
          return;
        }

        // No localStorage config, try backend config with retry
        console.log('Loading backend configuration...');
        const fetchedBackendConfig = await fetchBackendConfig(3, 1000); // 3 retries, 1 second delay
        setBackendConfig(fetchedBackendConfig);

        if (fetchedBackendConfig?.url && fetchedBackendConfig.hasAccessToken) {
          // Backend has complete config (URL + access token from CLI config)
          // Create a complete config and don't show modal
          setConfig({
            url: fetchedBackendConfig.url,
            accessToken: fetchedBackendConfig.accessToken || 'backend-managed', // Use actual token if provided
          });
          setConfigSource('backend');
          // Don't open config modal - backend has everything we need
          console.log('Using complete backend configuration, no user input required');
        } else if (fetchedBackendConfig?.url) {
          // Backend has URL but no access token
          setConfigSource('backend');
          setIsConfigModalOpen(true);
        } else {
          // No config available anywhere
          setConfigSource('none');
          setIsConfigModalOpen(true);
        }
      } catch (error) {
        console.error('Error loading configuration:', error);
        setConfigSource('none');
        setIsConfigModalOpen(true);
      }
    };

    loadConfiguration();
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
        console.error('Failed to load projects in App.tsx', err);
        if (!cachedProjects) {
          // Only set empty if no cache was loaded
          setProjects([]);
        }
      } finally {
        setIsLoadingProjects(false);
      }
    };
    loadProjects();
  }, [config]);

  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);

  const handleReviewRequest = useCallback(
    async (url: string) => {
      if (!url.trim()) {
        setError('Cannot start review with an empty URL.');
        return;
      }
      if (!config) {
        setError('GitLab configuration is missing. Please set it in the settings.');
        setIsConfigModalOpen(true);
        return;
      }

      setIsLoading(true);
      setError(null);
      setFeedback(null);
      setMrDetails(null);
      setIsAiAnalyzing(false);

      try {
        // Step 1: Fetch MR details quickly for immediate display
        const result = await fetchMrDetailsOnly(url, config);
        if (!result?.mrDetails) {
          throw new Error('Failed to fetch merge request details from GitLab');
        }

        // Set MR details and show existing comments immediately - this enables manual review
        setMrDetails(result.mrDetails);
        setFeedback(result.feedback || []); // Show existing comments right away
        setIsLoading(false); // User can now see the MR and start manual review

        // Step 2: Run AI review in background using the new unified API
        setIsAiAnalyzing(true);
        try {
          const aiResult = await runAiReview(url, config);

          // Combine existing feedback with new AI review feedback
          setFeedback((currentFeedback) => {
            const existingFeedback = currentFeedback || result.feedback || [];
            return [...existingFeedback, ...aiResult.feedback];
          });
          setIsAiAnalyzing(false);
        } catch (aiError) {
          console.error('AI Review failed:', aiError);
          setIsAiAnalyzing(false);

          // Set a non-blocking error message that doesn't prevent manual review
          const aiErrorMessage = aiError instanceof Error ? aiError.message : 'AI review failed';
          setError(`AI Review Error: ${aiErrorMessage}`);

          // Keep the existing feedback (GitLab comments) and MR details intact
          // This allows users to continue with manual review
        }
      } catch (error) {
        console.error('Error fetching MR details:', error);
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to fetch merge request details';
        setError(`Unable to load merge request: ${errorMessage}`);
        setIsLoading(false);
        setIsAiAnalyzing(false);
        // Clear everything if we can't even fetch MR details
        setMrDetails(null);
        setFeedback(null);
      }
    },
    [config]
  );

  const handleSaveConfig = (newConfig: Config) => {
    setConfig(newConfig);
    setError(null);
  };

  const handleClearError = useCallback(() => {
    setError(null);
  }, []);

  const handlePostComment = useCallback(
    async (feedbackId: string) => {
      if (!config || !mrDetails || !feedback) return;

      const feedbackItem = feedback.find((f) => f.id === feedbackId);
      if (!feedbackItem || feedbackItem.status !== 'pending' || feedbackItem.isEditing) return;

      setFeedback((prev) =>
        prev!.map((f) => (f.id === feedbackId ? { ...f, status: 'submitting' } : f))
      );

      try {
        await postDiscussion(config, mrDetails, feedbackItem);
        setFeedback((prev) =>
          prev!.map((f) => (f.id === feedbackId ? { ...f, status: 'submitted' } : f))
        );
      } catch (err) {
        console.error('Failed to post comment:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setFeedback((prev) =>
          prev!.map((f) =>
            f.id === feedbackId ? { ...f, status: 'error', submissionError: errorMessage } : f
          )
        );
      }
    },
    [config, mrDetails, feedback]
  );

  const handlePostAllComments = useCallback(async () => {
    if (!feedback) return;
    const pendingFeedback = feedback.filter(
      (f) => f.status === 'pending' && !f.isEditing && !f.isIgnored
    );
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
    setFeedback((prev) => prev!.map((f) => (f.id === feedbackId ? { ...f, isEditing } : f)));
  }, []);

  const handleDeleteFeedback = useCallback((feedbackId: string) => {
    setFeedback((prev) => prev!.filter((f) => f.id !== feedbackId));
  }, []);

  const handleUpdateFeedback = useCallback(
    (id: string, title: string, description: string, severity: Severity) => {
      setFeedback((prev) =>
        prev!.map((f) =>
          f.id === id
            ? { ...f, title, description, severity, isEditing: false, isNewlyAdded: false }
            : f
        )
      );
    },
    []
  );

  const handleApproveMR = useCallback(async () => {
    if (!config || !mrDetails) return;
    await approveMergeRequest(config, mrDetails.projectId, mrDetails.mrIid);
  }, [config, mrDetails]);

  const handleRedoReview = useCallback(async () => {
    if (!config || !mrDetails || isAiAnalyzing) return;

    setIsAiAnalyzing(true);
    setError(null);

    try {
      // Use the new unified AI review API
      const aiResult = await runAiReview(mrDetails.webUrl, config);

      // Combine all current feedback (including any manual comments) with new AI review comments
      setFeedback((currentFeedback) => {
        // Keep all current feedback (manual + existing) and add new AI results
        const existingFeedback = currentFeedback || mrDetails.existingFeedback || [];
        return [...existingFeedback, ...aiResult.feedback];
      });
    } catch (error) {
      console.error('Error during redo review:', error);
      const errorMessage = error instanceof Error ? error.message : 'AI review failed';
      const fullErrorMessage = `AI Review Error: ${errorMessage}`;

      // Set error state immediately to ensure UI shows the error
      setError(fullErrorMessage);

      // Keep existing feedback intact so user can continue with manual review
      // Don't clear the current feedback - preserve what's already there
    } finally {
      setIsAiAnalyzing(false);
    }
  }, [config, mrDetails, isAiAnalyzing]);

  const handleToggleIgnoreFeedback = useCallback((feedbackId: string) => {
    setFeedback((prev) =>
      prev!.map((f) => (f.id === feedbackId ? { ...f, isIgnored: !f.isIgnored } : f))
    );
  }, []);

  const handleAddCustomFeedback = useCallback(
    (fileDiff: ParsedFileDiff, line: ParsedDiffLine) => {
      if (!mrDetails) return;

      // Only block meta lines (like diff headers), but allow remove, add, and context lines
      if (line.type === 'meta') {
        return;
      }

      let position: GitLabPosition | null = null;
      let positionPayload: { old_line?: number; new_line?: number } = {};

      if (line.type === 'add' && line.newLine) {
        positionPayload = { new_line: line.newLine };
      } else if (line.type === 'remove' && line.oldLine) {
        positionPayload = { old_line: line.oldLine };
      } else if (line.type === 'context' && line.oldLine && line.newLine) {
        positionPayload = { old_line: line.oldLine, new_line: line.newLine };
      }

      // Create position if we have valid line references
      if (Object.keys(positionPayload).length > 0) {
        position = {
          base_sha: mrDetails.base_sha,
          start_sha: mrDetails.start_sha,
          head_sha: mrDetails.head_sha,
          position_type: 'text',
          old_path: fileDiff.oldPath,
          new_path: fileDiff.filePath,
          ...positionPayload,
        };
      }

      const newFeedback: ReviewFeedback = {
        id: uuidv4(),
        lineNumber: line.newLine || line.oldLine || 0,
        severity: Severity.Suggestion,
        title: 'Manual Input',
        description: '',
        filePath: fileDiff.filePath,
        lineContent: line.content,
        position,
        status: 'pending',
        isEditing: true,
        isNewlyAdded: true,
        isIgnored: false,
      };

      setFeedback((prev) => {
        if (!prev) return [newFeedback];
        // Add the new feedback while preserving all existing feedback
        return [...prev, newFeedback];
      });
    },
    [mrDetails]
  );

  const handleToggleHunkCollapse = useCallback((filePath: string, hunkIndex: number) => {
    setMrDetails((prevDetails) => {
      if (!prevDetails) return null;

      const newParsedDiffs = prevDetails.parsedDiffs.map((fileDiff) => {
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

  const handleExpandHunkContext = useCallback(
    (filePath: string, hunkIndex: number, direction: 'up' | 'down', linesToExpand: number) => {
      setMrDetails((prevDetails) => {
        if (!prevDetails) return null;

        const newDetails = JSON.parse(JSON.stringify(prevDetails));
        const fileDiff = newDetails.parsedDiffs.find(
          (f: ParsedFileDiff) => f.filePath === filePath
        );
        if (!fileDiff) return prevDetails;

        const hunk = fileDiff.hunks[hunkIndex];
        if (!hunk) return prevDetails;

        const fileContents = (
          newDetails.fileContents as Record<
            string,
            { oldContent?: string[]; newContent?: string[] }
          >
        )[filePath];
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
            newLines.push({
              type: 'context',
              content: content,
              oldLine: oldLineNum,
              newLine: newLineNum,
            });
          }

          hunk.lines = [...newLines, ...hunk.lines];
          hunk.oldStartLine = targetOldStart;
          hunk.newStartLine = targetNewStart;
          hunk.oldLineCount += actualOldLinesToAdd;
          hunk.newLineCount += actualNewLinesToAdd;
        } else {
          // direction 'down'
          const oldFileContent = fileContents.oldContent || [];
          const newFileContent = fileContents.newContent || [];

          const lastLine = hunk.lines[hunk.lines.length - 1];
          const currentOldEnd = lastLine.oldLine || hunk.oldStartLine + hunk.oldLineCount - 1;
          const currentNewEnd = lastLine.newLine || hunk.newStartLine + hunk.newLineCount - 1;

          const targetOldEnd = Math.min(oldFileContent.length, currentOldEnd + linesToExpand);
          const targetNewEnd = Math.min(newFileContent.length, currentNewEnd + linesToExpand);

          const actualOldLinesToAdd = targetOldEnd - currentOldEnd;
          const actualNewLinesToAdd = targetNewEnd - currentNewEnd;

          const newLines: ParsedDiffLine[] = [];
          for (let i = 1; i <= actualNewLinesToAdd; i++) {
            const newLineNum = currentNewEnd + i;
            const oldLineNum = currentOldEnd + i;
            const content = newFileContent[newLineNum - 1] ?? oldFileContent[oldLineNum - 1] ?? '';
            newLines.push({
              type: 'context',
              content: content,
              oldLine: oldLineNum,
              newLine: newLineNum,
            });
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
    },
    []
  );

  return (
    <div className="min-h-screen flex flex-col font-sans h-screen">
      <Header
        onOpenSettings={() => setIsConfigModalOpen(true)}
        onToggleTheme={handleThemeToggle}
        currentTheme={theme}
        onShowSyntaxDemo={() => setShowSyntaxDemo(!showSyntaxDemo)}
        showingSyntaxDemo={showSyntaxDemo}
      />
      <ConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onSave={handleSaveConfig}
        initialConfig={config}
        backendConfig={backendConfig}
        configSource={configSource}
      />
      <main className="flex-grow w-full px-2 md:px-4 lg:px-4 py-2 md:py-3 lg:py-3 h-full">
        {showSyntaxDemo ? (
          <div className="h-full overflow-y-auto bg-white dark:bg-brand-surface rounded-lg">
            <SyntaxHighlightingDemo isDarkMode={theme === 'dark'} />
          </div>
        ) : (
          <ResizablePane
            defaultSizePercent={mrDetails ? 25 : 33}
            minSizePercent={20}
            maxSizePercent={50}
            className="h-full"
            storageKey="main-layout"
          >
            <div className="flex flex-col h-full">
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
            <div className="flex flex-col h-full">
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
                onClearError={handleClearError}
              />
            </div>
          </ResizablePane>
        )}
      </main>
    </div>
  );
}

export default App;
