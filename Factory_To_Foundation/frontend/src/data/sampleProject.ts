export type ProjectObject = {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
};

export const sampleProject = [
  {
    id: "project",
    name: "Cedarwood Flats",
    type: "Project",
    parentId: null,
  },

  {
    id: "building-b",
    name: "Building B",
    type: "Building",
    parentId: "project",
  },

  {
    id: "level-3",
    name: "Level 3",
    type: "Level",
    parentId: "building-b",
  },

  {
    id: "module-089",
    name: "Module M24-089",
    type: "Module",
    parentId: "level-3",
  },

  {
    id: "wall-wa03",
    name: "Wall Panel WA-03-S",
    type: "Wall Panel",
    parentId: "module-089",
  },

  {
    id: "stud-frame",
    name: "LGS Stud Frame",
    type: "Component",
    parentId: "wall-wa03",
  },

  {
    id: "stud",
    name: "LGS Stud",
    type: "Material",
    parentId: "stud-frame",
  },

  {
    id: "osb",
    name: "OSB Sheathing",
    type: "Material",
    parentId: "stud-frame",
  },

  {
    id: "fasteners",
    name: "Fasteners",
    type: "Material",
    parentId: "stud-frame",
  },

  {
    id: "mep",
    name: "MEP Rough-In",
    type: "Material",
    parentId: "wall-wa03",
  },
];