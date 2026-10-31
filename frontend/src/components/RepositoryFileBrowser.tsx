'use client';

import React from 'react';
import { FileTreeNode } from '@/types';

interface RepositoryFileBrowserProps {
  tree: FileTreeNode[];
  sourceFiles: string[];
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
}

const EXT_ICONS: Record<string, string> = {
  '.py': '🐍',
  '.md': '📄',
  '.json': '{}',
  '.yaml': '⚙️',
  '.yml': '⚙️',
  '.toml': '⚙️',
  '.txt': '📝',
  '.sh': '💻',
  '.js': '🟡',
  '.ts': '🔷',
};

function buildTree(nodes: FileTreeNode[]) {
  const tree: Record<string, any> = {};
  for (const node of nodes) {
    const parts = node.path.split('/');
    let current = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = { __dir: true, __children: {} };
      current = current[parts[i]].__children;
    }
    const fname = parts[parts.length - 1];
    current[fname] = { __dir: false, __node: node };
  }
  return tree;
}

function TreeNode({
  name,
  entry,
  depth,
  selectedPath,
  onSelectFile,
}: {
  name: string;
  entry: any;
  depth: number;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
}) {
  const [open, setOpen] = React.useState(depth < 2);
  const indent = depth * 12;

  if (entry.__dir) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          style={{ paddingLeft: indent + 4 }}
          className="flex items-center gap-1.5 w-full text-left py-0.5 pr-2 hover:bg-slate-100 rounded text-xs text-slate-600"
        >
          <span className="text-slate-400">{open ? '▾' : '▸'}</span>
          <span>📁</span>
          <span className="font-medium">{name}</span>
        </button>
        {open && (
          <div>
            {Object.entries(entry.__children)
              .sort(([a, av]: any, [b, bv]: any) => {
                if (av.__dir && !bv.__dir) return -1;
                if (!av.__dir && bv.__dir) return 1;
                return a.localeCompare(b);
              })
              .map(([childName, childEntry]: any) => (
                <TreeNode
                  key={childName}
                  name={childName}
                  entry={childEntry}
                  depth={depth + 1}
                  selectedPath={selectedPath}
                  onSelectFile={onSelectFile}
                />
              ))}
          </div>
        )}
      </div>
    );
  }

  const node: FileTreeNode = entry.__node;
  const icon = EXT_ICONS[node.extension] ?? '📄';
  const isSelected = selectedPath === node.path;

  return (
    <button
      type="button"
      onClick={() => onSelectFile(node.path)}
      style={{ paddingLeft: indent + 4 }}
      className={`flex items-center gap-1.5 w-full text-left py-0.5 pr-2 rounded text-xs ${
        isSelected
          ? 'bg-indigo-50 text-indigo-700 font-semibold'
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <span className="w-4 text-center">{icon}</span>
      <span className="truncate">{name}</span>
      <span className="ml-auto text-slate-300 text-[10px]">
        {node.size_bytes < 1024
          ? `${node.size_bytes}B`
          : `${(node.size_bytes / 1024).toFixed(1)}KB`}
      </span>
    </button>
  );
}

export const RepositoryFileBrowser: React.FC<RepositoryFileBrowserProps> = ({
  tree,
  sourceFiles,
  selectedPath,
  onSelectFile,
}) => {
  const treeData = buildTree(tree);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="px-3 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Repository Tree</span>
        <span className="ml-auto text-xs text-slate-400">{tree.length} files</span>
      </div>
      <div className="p-1.5 max-h-[420px] overflow-y-auto font-mono">
        {Object.entries(treeData)
          .sort(([a, av]: any, [b, bv]: any) => {
            if (av.__dir && !bv.__dir) return -1;
            if (!av.__dir && bv.__dir) return 1;
            return a.localeCompare(b);
          })
          .map(([name, entry]: any) => (
            <TreeNode
              key={name}
              name={name}
              entry={entry}
              depth={0}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
            />
          ))}
      </div>
    </div>
  );
};
