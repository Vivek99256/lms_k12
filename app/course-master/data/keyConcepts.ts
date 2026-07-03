export interface KeyConcept {
  title: string;
  description: string;
  mastery: string;
  time: string;
}

export interface SubjectKeyConcepts {
  count: number;
  concepts: KeyConcept[];
}

export const KEY_CONCEPTS_BY_SUBJECT: Record<string, SubjectKeyConcepts> = {
  Science: {
    count: 17,
    concepts: [
      {
        title: 'Chemical Reaction Indicators',
        description:
          'Observations like change in state, color, gas evolution, or temperature indicate that a chemical reaction has taken place.',
        mastery: '90%',
        time: '15 min est.',
      },
      {
        title: 'Reactants and Products',
        description:
          'Substances that undergo chemical change in a reaction are called reactants, while the new substances formed are called products.',
        mastery: '95%',
        time: '10 min est.',
      },
      {
        title: 'Chemical Equation Representation',
        description:
          'Chemical reactions can be represented concisely using word equations or chemical formulae, indicating reactants, products, and the direction of the reaction.',
        mastery: '90%',
        time: '20 min est.',
      },
      {
        title: 'Law of Conservation of Mass',
        description:
          'This fundamental law states that mass can neither be created nor destroyed in a chemical reaction, necessitating that chemical equations must always be balanced.',
        mastery: '95%',
        time: '15 min est.',
      },
      {
        title: 'Balancing Chemical Equations',
        description:
          'The process of adjusting coefficients in a chemical equation to ensure that the number of atoms of each element is equal on both the reactant and product sides.',
        mastery: '85%',
        time: '60 min est.',
      },
      {
        title: 'Physical States and Conditions',
        description:
          'Chemical equations can be made more informative by indicating the physical states (solid, liquid, gas, aqueous) of substances and specific reaction conditions like temperature or catalysts.',
        mastery: '80%',
        time: '15 min est.',
      },
      {
        title: 'Combination Reaction',
        description:
          'A type of chemical reaction in which two or more reactants combine to form a single, more complex product.',
        mastery: '85%',
        time: '15 min est.',
      },
      {
        title: 'Decomposition Reaction',
        description:
          'A reaction where a single compound breaks down into two or more simpler substances, often requiring an input of energy.',
        mastery: '85%',
        time: '15 min est.',
      },
      {
        title: 'Exothermic Reactions',
        description:
          'Chemical reactions that release heat energy into the surroundings, causing the temperature of the reaction mixture to increase.',
        mastery: '85%',
        time: '15 min est.',
      },
    ],
  },
};

export function getKeyConceptsForSubject(subject: string): SubjectKeyConcepts | null {
  return KEY_CONCEPTS_BY_SUBJECT[subject] ?? null;
}
