import React from 'react';
import type { ParsedFileDiff } from '../types';

// Expand/Collapse icons
const ExpandAllIcon = () => (
  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
      clipRule="evenodd"
    />
  </svg>
);

const CollapseAllIcon = () => (
  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h8a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h4a1 1 0 110 2H4a1 1 0 01-1-1z"
      clipRule="evenodd"
    />
  </svg>
);

// File type icons
const FileIcon = ({ fileName }: { fileName: string }) => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  // Different colors for different file types
  const getFileTypeColor = (ext: string) => {
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'text-blue-600 dark:text-blue-400';
      case 'js':
      case 'jsx':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'css':
      case 'scss':
      case 'sass':
        return 'text-pink-600 dark:text-pink-400';
      case 'html':
        return 'text-orange-600 dark:text-orange-400';
      case 'json':
        return 'text-green-600 dark:text-green-400';
      case 'md':
        return 'text-gray-600 dark:text-gray-400';
      default:
        return 'text-gray-500 dark:text-gray-400';
    }
  };

  return (
    <svg
      className={`w-3 h-3 ${getFileTypeColor(extension)}`}
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path
        fillRule="evenodd"
        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
        clipRule="evenodd"
      />
    </svg>
  );
};

const FolderIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg className="w-3 h-3 text-blue-500 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
    {isOpen ? (
      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v5a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    ) : (
      <path
        fillRule="evenodd"
        d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v5a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"
        clipRule="evenodd"
      />
    )}
  </svg>
);

const StatusIcon = ({ fileDiff }: { fileDiff: ParsedFileDiff }) => {
  if (fileDiff.isNew) {
    return <span className="text-green-600 dark:text-green-400 text-xs font-semibold">A</span>;
  }
  if (fileDiff.isDeleted) {
    return <span className="text-red-600 dark:text-red-400 text-xs font-semibold">D</span>;
  }
  if (fileDiff.isRenamed) {
    return <span className="text-blue-600 dark:text-blue-400 text-xs font-semibold">R</span>;
  }
  return <span className="text-yellow-600 dark:text-yellow-400 text-xs font-semibold">M</span>;
};

interface FileTreeNode {
  name: string;
  path: string;
  isFile: boolean;
  fileDiff?: ParsedFileDiff;
  children: Map<string, FileTreeNode>;
}

interface FileTreeProps {
  fileDiffs: ParsedFileDiff[];
  onFileClick: (filePath: string) => void;
}

export const FileTree: React.FC<FileTreeProps> = ({ fileDiffs, onFileClick }) => {
  const [expandedFolders, setExpandedFolders] = React.useState<Set<string>>(new Set());

  // Helper function to get all folder paths
  const getAllFolderPaths = (node: FileTreeNode, paths: string[] = []): string[] => {
    if (!node.isFile && node.name) {
      paths.push(node.path);
    }
    node.children.forEach((child) => {
      getAllFolderPaths(child, paths);
    });
    return paths;
  };

  // Expand all folders
  const expandAll = () => {
    const tree = buildTree(fileDiffs);
    const allPaths = getAllFolderPaths(tree);
    setExpandedFolders(new Set(allPaths));
  };

  // Collapse all folders
  const collapseAll = () => {
    setExpandedFolders(new Set());
  };

  // Build tree structure from file paths
  const buildTree = (fileDiffs: ParsedFileDiff[]): FileTreeNode => {
    const root: FileTreeNode = {
      name: '',
      path: '',
      isFile: false,
      children: new Map(),
    };

    fileDiffs.forEach((fileDiff) => {
      const pathParts = fileDiff.filePath.split('/');
      let currentNode = root;
      let currentPath = '';

      pathParts.forEach((part, index) => {
        const isLastPart = index === pathParts.length - 1;
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        if (!currentNode.children.has(part)) {
          currentNode.children.set(part, {
            name: part,
            path: currentPath,
            isFile: isLastPart,
            fileDiff: isLastPart ? fileDiff : undefined,
            children: new Map(),
          });
        }

        currentNode = currentNode.children.get(part)!;
      });
    });

    return root;
  };

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const renderNode = (node: FileTreeNode, depth = 0): React.ReactNode => {
    if (node.isFile && node.fileDiff) {
      return (
        <div
          key={node.path}
          className="flex items-center space-x-1 py-0.5 px-1 hover:bg-gray-100 dark:hover:bg-brand-primary/30 rounded cursor-pointer text-xs group"
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
          onClick={() => onFileClick(node.fileDiff?.filePath)}
          title={`${node.fileDiff.filePath} - Click to scroll to file`}
        >
          <StatusIcon fileDiff={node.fileDiff} />
          <FileIcon fileName={node.name} />
          <span className="text-gray-700 dark:text-gray-300 truncate flex-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {node.name}
          </span>
        </div>
      );
    }

    // Folder node
    const isExpanded = expandedFolders.has(node.path);
    const children = Array.from(node.children.values());

    if (children.length === 0) return null;

    return (
      <div key={node.path}>
        {node.name && (
          <div
            className="flex items-center space-x-1 py-0.5 px-1 hover:bg-gray-50 dark:hover:bg-brand-primary/20 rounded cursor-pointer text-xs group"
            style={{ paddingLeft: `${depth * 12 + 4}px` }}
            onClick={() => toggleFolder(node.path)}
            title={`${isExpanded ? 'Collapse' : 'Expand'} folder: ${node.name}`}
          >
            <FolderIcon isOpen={isExpanded} />
            <span className="text-gray-600 dark:text-gray-400 font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {node.name}
            </span>
            <span className="text-gray-400 dark:text-gray-500 text-xs">
              ({children.filter((child) => child.isFile).length})
            </span>
          </div>
        )}
        {(isExpanded || !node.name) && (
          <div>
            {children
              .sort((a, b) => {
                // Folders first, then files
                if (!a.isFile && b.isFile) return -1;
                if (a.isFile && !b.isFile) return 1;
                return a.name.localeCompare(b.name);
              })
              .map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const tree = buildTree(fileDiffs);

  // Auto-expand all folders by default, then switch to selective expansion for large trees
  React.useEffect(() => {
    const allPaths = getAllFolderPaths(tree);
    // Always expand all folders by default as requested
    setExpandedFolders(new Set(allPaths));
  }, [fileDiffs]);

  const totalFiles = fileDiffs.length;
  const addedFiles = fileDiffs.filter((f) => f.isNew).length;
  const modifiedFiles = fileDiffs.filter((f) => !f.isNew && !f.isDeleted && !f.isRenamed).length;
  const deletedFiles = fileDiffs.filter((f) => f.isDeleted).length;
  const renamedFiles = fileDiffs.filter((f) => f.isRenamed).length;

  return (
    <div className="space-y-2 flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between flex-shrink-0">
        <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">
          Files Changed ({totalFiles})
        </h3>
        <div className="flex items-center space-x-0.5">
          <button
            onClick={expandAll}
            className="flex items-center space-x-0.5 text-xs text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors px-1.5 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-brand-primary/30"
            title="Expand all folders"
          >
            <ExpandAllIcon />
            <span>All</span>
          </button>
          <button
            onClick={collapseAll}
            className="flex items-center space-x-0.5 text-xs text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors px-1.5 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-brand-primary/30"
            title="Collapse all folders"
          >
            <CollapseAllIcon />
            <span>Min</span>
          </button>
        </div>
      </div>

      {/* File stats */}
      <div className="flex flex-wrap gap-1 text-xs flex-shrink-0">
        {addedFiles > 0 && (
          <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded">
            +{addedFiles}
          </span>
        )}
        {modifiedFiles > 0 && (
          <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-1.5 py-0.5 rounded">
            ~{modifiedFiles}
          </span>
        )}
        {deletedFiles > 0 && (
          <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded">
            -{deletedFiles}
          </span>
        )}
        {renamedFiles > 0 && (
          <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
            R{renamedFiles}
          </span>
        )}
      </div>

      {/* File tree */}
      <div
        className="flex-1 min-h-0 overflow-y-auto border border-gray-200 dark:border-brand-primary/30 bg-gray-50/50 dark:bg-brand-primary/10 rounded p-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600"
        style={{ maxHeight: 'calc(100vh - 410px)' }}
      >
        {totalFiles === 0 ? (
          <div className="text-xs text-gray-500 dark:text-gray-400 p-2 text-center">
            No files changed
          </div>
        ) : (
          renderNode(tree)
        )}
      </div>
    </div>
  );
};
