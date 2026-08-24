export interface KeyConcept {
  title: string;
  description: string;
  mastery: string;
  time: string;
}

export interface ChapterKeyConceptGroup {
  count: number;
  concepts: KeyConcept[];
}

const CHAPTER_KEY_CONCEPTS: Record<string, Record<string, ChapterKeyConceptGroup>> = {
  c2: {
    ch1: {
      count: 17,
      concepts: [
        {
          title: 'Chemical Reaction Indicators',
          description:
            'Observations like change in state, color, gas evolution, or temperature indicate that a chemical reaction has taken place.',
          mastery: '90% Mastery',
          time: '15 min est.',
        },
        {
          title: 'Reactants and Products',
          description:
            'Substances that undergo chemical change in a reaction are called reactants, while the new substances formed are called products.',
          mastery: '95% Mastery',
          time: '10 min est.',
        },
        {
          title: 'Chemical Equation Representation',
          description:
            'Chemical reactions can be represented concisely using word equations or chemical formulae, indicating reactants, products, and the direction of the reaction.',
          mastery: '90% Mastery',
          time: '20 min est.',
        },
        {
          title: 'Law of Conservation of Mass',
          description:
            'This fundamental law states that mass can neither be created nor destroyed in a chemical reaction, necessitating that chemical equations must always be balanced.',
          mastery: '95% Mastery',
          time: '15 min est.',
        },
        {
          title: 'Balancing Chemical Equations',
          description:
            'The process of adjusting coefficients in a chemical equation to ensure that the number of atoms of each element is equal on both the reactant and product sides.',
          mastery: '85% Mastery',
          time: '60 min est.',
        },
        {
          title: 'Physical States and Conditions',
          description:
            'Chemical equations can be made more informative by indicating the physical states (solid, liquid, gas, aqueous) of substances and specific reaction conditions like temperature or catalysts.',
          mastery: '80% Mastery',
          time: '15 min est.',
        },
        {
          title: 'Combination Reaction',
          description:
            'A type of chemical reaction in which two or more reactants combine to form a single, more complex product.',
          mastery: '85% Mastery',
          time: '15 min est.',
        },
        {
          title: 'Decomposition Reaction',
          description:
            'A reaction where a single compound breaks down into two or more simpler substances, often requiring an input of energy.',
          mastery: '85% Mastery',
          time: '15 min est.',
        },
        {
          title: 'Exothermic Reactions',
          description:
            'Chemical reactions that release heat energy into the surroundings, causing the temperature of the reaction mixture to increase.',
          mastery: '85% Mastery',
          time: '15 min est.',
        },
        {
          title: 'Endothermic Reactions',
          description:
            'Chemical reactions that absorb heat energy from the surroundings, lowering the surrounding temperature.',
          mastery: '80% Mastery',
          time: '12 min est.',
        },
        {
          title: 'Oxidation and Reduction',
          description:
            'Oxidation involves gain of oxygen or loss of hydrogen, while reduction involves loss of oxygen or gain of hydrogen.',
          mastery: '88% Mastery',
          time: '18 min est.',
        },
        {
          title: 'Corrosion',
          description:
            'Corrosion is the gradual destruction of metals by reaction with oxygen, moisture, or other chemicals in the environment.',
          mastery: '82% Mastery',
          time: '14 min est.',
        },
        {
          title: 'Rancidity',
          description:
            'Rancidity is the oxidation of fats and oils that causes an unpleasant smell and taste in food.',
          mastery: '78% Mastery',
          time: '10 min est.',
        },
        {
          title: 'Chemical Equation Symbols',
          description:
            'Symbols such as (s), (l), (g), and (aq) communicate the physical state of substances in a chemical equation.',
          mastery: '84% Mastery',
          time: '11 min est.',
        },
        {
          title: 'Reaction Conditions',
          description:
            'Temperature, catalyst, pressure, and light are written near equations to indicate the conditions needed for a reaction.',
          mastery: '83% Mastery',
          time: '13 min est.',
        },
        {
          title: 'Atom Conservation',
          description:
            'A balanced equation must have the same number of atoms of each element on both sides of the reaction.',
          mastery: '91% Mastery',
          time: '16 min est.',
        },
        {
          title: 'Word Equation to Formula Equation',
          description:
            'Word equations are converted into formula equations by replacing names of substances with their chemical formulas.',
          mastery: '87% Mastery',
          time: '17 min est.',
        },
      ],
    },
    ch2: {
      count: 6,
      concepts: [
        {
          title: 'Acid and Base Indicators',
          description:
            'Indicators such as litmus, phenolphthalein, and methyl orange help identify acidic and basic substances.',
          mastery: '90% Mastery',
          time: '12 min est.',
        },
        {
          title: 'pH Scale',
          description:
            'The pH scale measures the acidity or basicity of a solution on a scale from 0 to 14.',
          mastery: '92% Mastery',
          time: '14 min est.',
        },
        {
          title: 'Neutralization Reaction',
          description:
            'An acid reacts with a base to form salt and water in a neutralization process.',
          mastery: '88% Mastery',
          time: '15 min est.',
        },
        {
          title: 'Common Salts',
          description:
            'Common salts are formed from strong acids and bases and are used in daily life and industry.',
          mastery: '84% Mastery',
          time: '13 min est.',
        },
        {
          title: 'Nature of Acids',
          description:
            'Acids release hydrogen ions in aqueous solutions and have a sour taste.',
          mastery: '86% Mastery',
          time: '10 min est.',
        },
        {
          title: 'Nature of Bases',
          description:
            'Bases release hydroxide ions in aqueous solutions and feel slippery to the touch.',
          mastery: '86% Mastery',
          time: '10 min est.',
        },
      ],
    },
    ch3: {
      count: 5,
      concepts: [
        {
          title: 'Reactivity Series',
          description:
            'Metals can be arranged in order of decreasing reactivity based on their tendency to lose electrons.',
          mastery: '89% Mastery',
          time: '15 min est.',
        },
        {
          title: 'Physical Properties of Metals',
          description:
            'Metals are generally lustrous, malleable, ductile, and good conductors of heat and electricity.',
          mastery: '88% Mastery',
          time: '12 min est.',
        },
        {
          title: 'Corrosion Prevention',
          description:
            'Coating, painting, galvanizing, and alloying are methods used to prevent corrosion of metals.',
          mastery: '85% Mastery',
          time: '15 min est.',
        },
        {
          title: 'Metals vs Non-metals',
          description:
            'Metals and non-metals differ in conductivity, appearance, hardness, and chemical behavior.',
          mastery: '87% Mastery',
          time: '14 min est.',
        },
        {
          title: 'Extraction of Metals',
          description:
            'Metals are extracted from ores by reduction, electrolysis, or thermal decomposition depending on their reactivity.',
          mastery: '83% Mastery',
          time: '18 min est.',
        },
      ],
    },
    ch4: {
      count: 5,
      concepts: [
        {
          title: 'Covalent Bonding',
          description:
            'Carbon compounds mainly form covalent bonds through sharing of electrons.',
          mastery: '90% Mastery',
          time: '15 min est.',
        },
        {
          title: 'Hydrocarbons',
          description:
            'Hydrocarbons are compounds made only of carbon and hydrogen atoms.',
          mastery: '88% Mastery',
          time: '12 min est.',
        },
        {
          title: 'Ethanol and Acetic Acid',
          description:
            'Ethanol and acetic acid are important carbon compounds with distinct physical and chemical properties.',
          mastery: '84% Mastery',
          time: '14 min est.',
        },
        {
          title: 'Soap and Detergents',
          description:
            'Soap and detergents remove grease and dirt through their surfactant action.',
          mastery: '86% Mastery',
          time: '13 min est.',
        },
        {
          title: 'Carbon Compounds in Daily Life',
          description:
            'Carbon compounds are used in fuels, food, medicines, plastics, and fabrics.',
          mastery: '82% Mastery',
          time: '10 min est.',
        },
      ],
    },
    ch5: {
      count: 5,
      concepts: [
        {
          title: 'Nutrition',
          description:
            'Nutrition is the process by which organisms obtain and use food for energy and growth.',
          mastery: '91% Mastery',
          time: '15 min est.',
        },
        {
          title: 'Respiration',
          description:
            'Respiration is the process of breaking down food to release energy in cells.',
          mastery: '89% Mastery',
          time: '15 min est.',
        },
        {
          title: 'Transportation in Organisms',
          description:
            'Transportation moves water, nutrients, and gases throughout the body.',
          mastery: '87% Mastery',
          time: '16 min est.',
        },
        {
          title: 'Excretion',
          description:
            'Excretion removes waste products from the body to maintain internal balance.',
          mastery: '85% Mastery',
          time: '12 min est.',
        },
        {
          title: 'Life Processes Overview',
          description:
            'Nutrition, respiration, transportation, and excretion are essential life processes.',
          mastery: '88% Mastery',
          time: '18 min est.',
        },
      ],
    },
  },
  c1: {
    ch1: {
      count: 10,
      concepts: [
        {
          title: 'What is Social Science?',
          description:
            'Social science studies people, places, history, and society to understand human life and social relationships.',
          mastery: '88% Mastery',
          time: '10 min est.',
        },
        {
          title: 'Branches of Social Science',
          description:
            'Geography, history, civics, and economics are the main branches used to study society and daily life.',
          mastery: '86% Mastery',
          time: '12 min est.',
        },
        {
          title: 'History and Historical Sources',
          description:
            'Historical sources such as books, monuments, artifacts, and records help us learn about the past.',
          mastery: '84% Mastery',
          time: '15 min est.',
        },
        {
          title: 'Geography and the Earth\'s Features',
          description:
            'Geography studies the Earth, its physical features, and the relationship between people and places.',
          mastery: '82% Mastery',
          time: '11 min est.',
        },
        {
          title: 'Civics and Citizenship',
          description:
            'Civics explains rights, duties, and responsibilities that make a good citizen and support public life.',
          mastery: '83% Mastery',
          time: '9 min est.',
        },
        {
          title: 'Economics and Resources',
          description:
            'Economics studies how people use limited resources to satisfy needs and make choices.',
          mastery: '85% Mastery',
          time: '13 min est.',
        },
        {
          title: 'Society and Culture',
          description:
            'Society and culture shape the way people live, interact, and follow shared traditions and values.',
          mastery: '84% Mastery',
          time: '12 min est.',
        },
        {
          title: 'Human Environment',
          description:
            'Human activities interact with the natural environment and shape the world around us.',
          mastery: '83% Mastery',
          time: '14 min est.',
        },
        {
          title: 'Maps and Globe Basics',
          description:
            'Maps and globes help us understand directions, locations, and the shape of the Earth.',
          mastery: '87% Mastery',
          time: '10 min est.',
        },
        {
          title: 'Importance of Social Science in Daily Life',
          description:
            'Social science helps us understand society, make informed decisions, and live responsibly in the world.',
          mastery: '89% Mastery',
          time: '15 min est.',
        },
      ],
    },
    ch2: {
      count: 5,
      concepts: [
        {
          title: 'Map Symbols',
          description:
            'Symbols are used to represent roads, rivers, buildings, and other features on maps.',
          mastery: '90% Mastery',
          time: '12 min est.',
        },
        {
          title: 'Latitude and Longitude',
          description:
            'Latitude and longitude help locate any place on Earth accurately.',
          mastery: '92% Mastery',
          time: '14 min est.',
        },
        {
          title: 'Map Scale',
          description:
            'Scale shows the relationship between map distance and real distance on the ground.',
          mastery: '88% Mastery',
          time: '10 min est.',
        },
        {
          title: 'Directions on a Map',
          description:
            'North, south, east, and west help us understand location and movement on maps.',
          mastery: '86% Mastery',
          time: '11 min est.',
        },
        {
          title: 'Reading a Map',
          description:
            'A map is read using its title, legend, scale, and directional indicators.',
          mastery: '84% Mastery',
          time: '13 min est.',
        },
      ],
    },
    ch3: {
      count: 5,
      concepts: [
        {
          title: 'Historical Sources',
          description:
            'Sources such as manuscripts, monuments, and artifacts help us learn about the past.',
          mastery: '90% Mastery',
          time: '12 min est.',
        },
        {
          title: 'Timelines',
          description:
            'Timelines arrange events in chronological order and help track historical change.',
          mastery: '89% Mastery',
          time: '10 min est.',
        },
        {
          title: 'Heritage and Culture',
          description:
            'Heritage includes traditions, monuments, language, and customs passed through generations.',
          mastery: '87% Mastery',
          time: '15 min est.',
        },
        {
          title: 'Ancient to Modern Society',
          description:
            'Societies change over time through technology, governance, and cultural development.',
          mastery: '85% Mastery',
          time: '14 min est.',
        },
        {
          title: 'Preserving History',
          description:
            'Preserving records and monuments helps protect historical knowledge for future generations.',
          mastery: '83% Mastery',
          time: '11 min est.',
        },
      ],
    },
  },
};

export function getChapterKeyConcepts(courseId: string, chapterId: string): ChapterKeyConceptGroup | null {
  return CHAPTER_KEY_CONCEPTS[courseId]?.[chapterId] ?? null;
}
