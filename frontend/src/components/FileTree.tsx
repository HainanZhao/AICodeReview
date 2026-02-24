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
        return 'text-[#1f75cb] dark:text-[#428fdc]';
      case 'js':
      case 'jsx':
        return 'text-[#e75e00] dark:text-[#fc9403]';
      case 'css':
      case 'scss':
      case 'sass':
        return 'text-[#6b4fbb] dark:text-[#a98dfd]';
      case 'html':
        return 'text-[#e75e00] dark:text-[#fc9403]';
      case 'json':
        return 'text-[#108548] dark:text-[#3db378]';
      case 'md':
        return 'text-[#444444] dark:text-[#a1a1aa]';
      default:
        return 'text-[#444444] dark:text-[#a1a1aa]';
    }
  };

  return (
    <svg
      className={`w-4 h-4 flex-shrink-0 ${getFileTypeColor(extension)}`}
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
  <svg className="w-4 h-4 flex-shrink-0 text-[#1f75cb] dark:text-[#428fdc]" fill="currentColor" viewBox="0 0 20 20">
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
    return <span className="text-[#108548] text-[10px] font-bold w-3 text-center">A</span>;
  }
  if (fileDiff.isDeleted) {
    return <span className="text-[#db3b21] text-[10px] font-bold w-3 text-center">D</span>;
  }
  if (fileDiff.isRenamed) {
    return <span className="text-[#1f75cb] text-[10px] font-bold w-3 text-center">R</span>;
  }
  return <span className="text-[#e75e00] text-[10px] font-bold w-3 text-center">M</span>;
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
          className="flex items-center space-x-2 py-1 px-1.5 hover:bg-[#f0f0f0] dark:hover:bg-[#2e2e33] rounded cursor-pointer text-[12.5px] group transition-colors"
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
          onClick={() => onFileClick(node.fileDiff?.filePath)}
          title={`${node.fileDiff.filePath} - Click to scroll to file`}
        >
          <StatusIcon fileDiff={node.fileDiff} />
          <FileIcon fileName={node.name} />
          <span className="text-[#111111] dark:text-[#ececec] font-medium truncate flex-1 group-hover:text-[#1f75cb] dark:group-hover:text-[#428fdc]">
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
            className="flex items-center space-x-2 py-1 px-1.5 hover:bg-[#f0f0f0] dark:hover:bg-[#2e2e33] rounded cursor-pointer text-[12.5px] group transition-colors"
            style={{ paddingLeft: `${depth * 14 + 6}px` }}
            onClick={() => toggleFolder(node.path)}
            title={`${isExpanded ? 'Collapse' : 'Expand'} folder: ${node.name}`}
          >
            <FolderIcon isOpen={isExpanded} />
            <span className="text-[#444444] dark:text-[#a1a1aa] font-bold group-hover:text-[#333333] dark:group-hover:text-[#dbdbdb]">
              {node.name}
            </span>
            <span className="text-[#8c8c8c] dark:text-[#666666] text-[11px] font-bold">
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
      <div className="flex items-center justify-between flex-shrink-0 px-1">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#444444] dark:text-[#a1a1aa]">
          Files Changed ({totalFiles})
        </h3>
        <div className="flex items-center space-x-1">
          <button
            onClick={expandAll}
            className="flex items-center space-x-1 text-[10px] font-bold text-[#444444] dark:text-[#a1a1aa] hover:text-[#1f75cb] dark:hover:text-[#428fdc] transition-colors px-1.5 py-0.5 rounded hover:bg-[#f0f0f0] dark:hover:bg-[#2e2e33]"
            title="Expand all"
          >
            <ExpandAllIcon />
            <span>EXPAND</span>
          </button>
          <button
            onClick={collapseAll}
            className="flex items-center space-x-1 text-[10px] font-bold text-[#444444] dark:text-[#a1a1aa] hover:text-[#1f75cb] dark:hover:text-[#428fdc] transition-colors px-1.5 py-0.5 rounded hover:bg-[#f0f0f0] dark:hover:bg-[#2e2e33]"
            title="Collapse all"
          >
            <CollapseAllIcon />
            <span>MIN</span>
          </button>
        </div>
      </div>

      {/* File stats */}
      <div className="flex flex-wrap gap-1 px-1 flex-shrink-0">
        {addedFiles > 0 && (
          <span className="bg-[#108548]/10 text-[#108548] text-[10px] font-bold px-1.5 py-0.5 rounded border border-[#108548]/20">
            +{addedFiles}
          </span>
        )}
        {modifiedFiles > 0 && (
          <span className="bg-[#e75e00]/10 text-[#e75e00] text-[10px] font-bold px-1.5 py-0.5 rounded border border-[#e75e00]/20">
            ~{modifiedFiles}
          </span>
        )}
        {deletedFiles > 0 && (
          <span className="bg-[#db3b21]/10 text-[#db3b21] text-[10px] font-bold px-1.5 py-0.5 rounded border border-[#db3b21]/20">
            -{deletedFiles}
          </span>
        )}
        {renamedFiles > 0 && (
          <span className="bg-[#1f75cb]/10 text-[#1f75cb] text-[10px] font-bold px-1.5 py-0.5 rounded border border-[#1f75cb]/20">
            R{renamedFiles}
          </span>
        )}
      </div>

      {/* File tree */}
      <div
        className="flex-1 min-h-0 overflow-y-auto border border-[#dbdbdb] dark:border-[#404040] bg-[#fbfbfb] dark:bg-[#1f1e24] rounded p-1.5 scrollbar-thin"
        style={{ maxHeight: 'calc(100vh - 410px)' }}
      >
        {totalFiles === 0 ? (
          <div className="text-[12px] font-medium text-[#444444] dark:text-[#a1a1aa] p-4 text-center">
            No active changes detected
          </div>
        ) : (
          renderNode(tree)
        )}
      </div>
    </div>
  );
};
