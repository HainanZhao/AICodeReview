const getSubPath = (): string => {
  return (window as { SUB_PATH?: string }).SUB_PATH || process.env.SUB_PATH || '';
};

export const getApiUrl = (path: string): string => {
  const subPath = getSubPath();
  const prefix = subPath ? `/${subPath}` : '';
  const normalizedPath = path.startsWith('/') ? path.substring(1) : path;
  return `${prefix}/${normalizedPath}`;
};
