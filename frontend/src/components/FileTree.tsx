import React from 'react';
import type { ParsedFileDiff } from '../types';

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

const FileIcon = ({ fileName }: { fileName: string }) => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  const getFileTypeColor = (ext: string) => {
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'text-[#00f0ff]';
      case 'js':
      case 'jsx':
        return 'text-[#fcee0a]';
      case 'css':
      case 'scss':
      case 'sass':
        return 'text-[#ff2a6d]';
      case 'html':
        return 'text-[#fcee0a]';
      case 'json':
        return 'text-[#05ffa1]';
      case 'md':
        return 'text-[#a1a1aa]';
      default:
        return 'text-[#a1a1aa]';
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
  <svg className="w-4 h-4 flex-shrink-0 text-[#00f0ff]" fill="currentColor" viewBox="0 0 20 20">
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
    return <span className="text-[#05ffa1] text-[10px] font-bold w-3 text-center">A</span>;
  }
  if (fileDiff.isDeleted) {
    return <span className="text-[#ff2a6d] text-[10px] font-bold w-3 text-center">D</span>;
  }
  if (fileDiff.isRenamed) {
    return <span className="text-[#00f0ff] text-[10px] font-bold w-3 text-center">R</span>;
  }
  return <span className="text-[#fcee0a] text-[10px] font-bold w-3 text-center">M</span>;
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

  const getAllFolderPaths = (node: FileTreeNode, paths: string[] = []): string[] => {
    if (!node.isFile && node.name) {
      paths.push(node.path);
    }
    node.children.forEach((child) => {
      getAllFolderPaths(child, paths);
    });
    return paths;
  };

  const expandAll = () => {
    const tree = buildTree(fileDiffs);
    const allPaths = getAllFolderPaths(tree);
    setExpandedFolders(new Set(allPaths));
  };

  const collapseAll = () => {
    setExpandedFolders(new Set());
  };

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
          className="flex items-center space-x-2 py-1 px-1.5 hover:bg-[#00f0ff]/10 cursor-pointer text-[12px] group transition-colors border-l-2 border-transparent hover:border-[#00f0ff]"
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
          onClick={() => onFileClick(node.fileDiff!.filePath)}
          title={`${node.fileDiff.filePath} - Click to scroll to file`}
        >
          <StatusIcon fileDiff={node.fileDiff} />
          <FileIcon fileName={node.name} />
          <span className="text-[#ececec] font-medium truncate flex-1 group-hover:text-[#00f0ff]">
            {node.name}
          </span>
        </div>
      );
    }

    const isExpanded = expandedFolders.has(node.path);
    const children = Array.from(node.children.values());

    if (children.length === 0) return null;

    return (
      <div key={node.path}>
        {node.name && (
          <div
            className="flex items-center space-x-2 py-1 px-1.5 hover:bg-[#00f0ff]/10 cursor-pointer text-[12px] group transition-colors border-l-2 border-transparent hover:border-[#00f0ff]"
            style={{ paddingLeft: `${depth * 14 + 6}px` }}
            onClick={() => toggleFolder(node.path)}
            title={`${isExpanded ? 'Collapse' : 'Expand'} folder: ${node.name}`}
          >
            <FolderIcon isOpen={isExpanded} />
            <span className="text-[#a1a1aa] font-bold group-hover:text-[#00f0ff]">{node.name}</span>
            <span className="text-[#a1a1aa]/50 text-[10px] font-bold">
              ({children.filter((child) => child.isFile).length})
            </span>
          </div>
        )}
        {(isExpanded || !node.name) && (
          <div>
            {children
              .sort((a, b) => {
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

  React.useEffect(() => {
    const allPaths = getAllFolderPaths(tree);
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
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#a1a1aa]">
          FILES ({totalFiles})
        </h3>
        <div className="flex items-center space-x-1">
          <button
            onClick={expandAll}
            className="cyber-btn cyber-btn--ghost cyber-btn--xs"
            title="Expand all"
          >
            <ExpandAllIcon />
          </button>
          <button
            onClick={collapseAll}
            className="cyber-btn cyber-btn--ghost cyber-btn--xs"
            title="Collapse all"
          >
            <CollapseAllIcon />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 px-1 flex-shrink-0">
        {addedFiles > 0 && (
          <span className="bg-[#05ffa1]/10 text-[#05ffa1] text-[10px] font-bold px-2 py-0.5 border border-[#05ffa1]/30 shadow-[0_0_5px_rgba(5,255,161,0.2)]">
            +{addedFiles}
          </span>
        )}
        {modifiedFiles > 0 && (
          <span className="bg-[#fcee0a]/10 text-[#fcee0a] text-[10px] font-bold px-2 py-0.5 border border-[#fcee0a]/30 shadow-[0_0_5px_rgba(252,238,10,0.2)]">
            ~{modifiedFiles}
          </span>
        )}
        {deletedFiles > 0 && (
          <span className="bg-[#ff2a6d]/10 text-[#ff2a6d] text-[10px] font-bold px-2 py-0.5 border border-[#ff2a6d]/30 shadow-[0_0_5px_rgba(255,42,109,0.2)]">
            -{deletedFiles}
          </span>
        )}
        {renamedFiles > 0 && (
          <span className="bg-[#00f0ff]/10 text-[#00f0ff] text-[10px] font-bold px-2 py-0.5 border border-[#00f0ff]/30 shadow-[0_0_5px_rgba(0,240,255,0.2)]">
            R{renamedFiles}
          </span>
        )}
      </div>

      <div
        className="flex-1 min-h-0 overflow-y-auto cyber-card border border-[#00f0ff]/20 p-1.5"
        style={{ maxHeight: 'calc(100vh - 410px)' }}
      >
        {totalFiles === 0 ? (
          <div className="text-[12px] font-medium text-[#a1a1aa] p-4 text-center uppercase tracking-wider">
            No active changes detected
          </div>
        ) : (
          renderNode(tree)
        )}
      </div>
    </div>
  );
};
