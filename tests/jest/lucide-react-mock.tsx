import React from 'react';

const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement>) => (
  <span {...props} data-icon={name} />
);

export const Calculator = Icon('Calculator');
export const BarChart3 = Icon('BarChart3');
export const LogOut = Icon('LogOut');
export const User = Icon('User');
export const UserRound = Icon('UserRound');
export const BookOpen = Icon('BookOpen');
export const FolderKanban = Icon('FolderKanban');
export const FileCheck = Icon('FileCheck');
export const GitPullRequest = Icon('GitPullRequest');
export const TrendingUp = Icon('TrendingUp');
export const Layers = Icon('Layers');
export const Shield = Icon('Shield');
