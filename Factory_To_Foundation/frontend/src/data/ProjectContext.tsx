import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

import {
  sampleProject,
  type ProjectObject,
} from "./sampleProject";

type ProjectContextType = {
  objects: ProjectObject[];
};

const ProjectContext = createContext<ProjectContextType | undefined>(
  undefined
);

type ProjectProviderProps = {
  children: ReactNode;
};

export function ProjectProvider({
  children,
}: ProjectProviderProps) {
  return (
    <ProjectContext.Provider
      value={{
        objects: sampleProject,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);

  if (!context) {
    throw new Error(
      "useProject must be used inside ProjectProvider."
    );
  }

  return context;
}