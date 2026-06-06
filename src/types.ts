export interface RepoContext {
  projectName: string;
  description: string;
  primaryLanguage: string;
  frameworks: string[];
  packageManager: string;
  hasTests: boolean;
  testFramework: string;
  folderStructure: string[];
  keyFiles: string[];
  scripts: Record<string, string>;
  dependencies: string[];
  devDependencies: string[];
  hasDocker: boolean;
  hasCI: boolean;
  linter: string;
}
