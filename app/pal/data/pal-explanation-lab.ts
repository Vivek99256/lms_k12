import type { PrayogshalaActivity } from '@/app/course-master/data/prayogshala';
import type { AdaptiveConcept } from '@/app/pal/data/pal-diagnostic';

/**
 * Explanation Lab — Topic-Specific Practical Learning & Experiment Engine.
 *
 * Automatically analyzes student performance from Adaptive Practice (scores,
 * wrong answers, identified learning gaps) and provides dynamically generated,
 * topic-specific, practical, and experiment-based explanations for concepts the
 * student is struggling with.
 */

export const WEAK_BELOW_PERCENT = 70;

export type ConceptStrength = 'weak' | 'understood' | 'not-assessed';
export type PerformanceLevel = 'struggling' | 'developing' | 'proficient';

export interface WrongQuestionRecord {
  questionId: string;
  title: string;
  selectedOptionText?: string;
  correctOptionText?: string;
  feedback?: string;
  difficulty?: string;
}

export interface AdaptivePracticeAnalysis {
  chapterId: string;
  chapterName: string;
  conceptId: string;
  conceptName: string;
  score: {
    correct: number;
    total: number;
    percentage: number;
  };
  difficulty: string;
  performanceLevel: PerformanceLevel;
  wrongQuestions: WrongQuestionRecord[];
  learningGaps: string[];
  completedAt: string;
}

export interface InteractiveSimulationVariable {
  id: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

export interface SimulationResult {
  valueDisplay: string;
  observationText: string;
  statusColor: 'emerald' | 'amber' | 'sky' | 'purple' | 'rose';
  scientificPrinciple: string;
  visualMetrics?: { label: string; percent: number; color?: string }[];
}

export interface VerificationQuestion {
  id: string;
  question: string;
  options: {
    id: string;
    label: string;
    isCorrect: boolean;
    explanation: string;
  }[];
}

export interface TopicSpecificLabActivity {
  id: string;
  conceptId: string;
  conceptName: string;
  chapterName: string;
  subjectName: string;
  title: string;
  objective: string;
  performanceLevel: PerformanceLevel;
  difficultyLabel: string;
  learningGapNotice: string;
  estimatedMinutes: number;
  materials: { name: string; purpose: string }[];
  procedureSteps: { step: number; instruction: string; tip?: string }[];
  primaryVariable: InteractiveSimulationVariable;
  secondaryVariable?: InteractiveSimulationVariable;
  computeObservation: (val1: number, val2?: number) => SimulationResult;
  realWorldDemonstration: {
    scenarioTitle: string;
    realWorldExample: string;
    whyMisconceptionOccurs: string;
    practicalTakeaway: string;
  };
  verificationQuestions: VerificationQuestion[];
  prayogshalaActivity: PrayogshalaActivity;
}

export interface ConceptRecommendation {
  concept: AdaptiveConcept;
  score: number;
  scoreSource: 'concept-diagnostic' | 'chapter-diagnostic' | 'adaptive-practice';
  experiments: PrayogshalaActivity[];
  chapterWide: boolean;
  generatedLab?: TopicSpecificLabActivity;
}

export interface ExplanationLabPlan {
  hasResults: boolean;
  recommendations: ConceptRecommendation[];
  understoodCount: number;
  notAssessedCount: number;
  activeAnalysis?: AdaptivePracticeAnalysis | null;
}

// ---------------------------------------------------------------------------
// Storage Helpers for Adaptive Practice Session Results
// ---------------------------------------------------------------------------

export function saveAdaptivePracticeAnalysis(
  chapterId: string,
  analysis: AdaptivePracticeAnalysis
): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      `pal_adaptive_practice_analysis_${chapterId}`,
      JSON.stringify(analysis)
    );
    // Also record in cumulative concept history map
    const historyKey = `pal_adaptive_practice_history_${chapterId}`;
    const raw = sessionStorage.getItem(historyKey);
    const history: Record<string, AdaptivePracticeAnalysis> = raw ? JSON.parse(raw) : {};
    history[analysis.conceptId] = analysis;
    sessionStorage.setItem(historyKey, JSON.stringify(history));
  } catch {}
}

export function getAdaptivePracticeAnalysis(
  chapterId: string
): AdaptivePracticeAnalysis | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`pal_adaptive_practice_analysis_${chapterId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export function getAdaptivePracticeHistory(
  chapterId: string
): Record<string, AdaptivePracticeAnalysis> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(`pal_adaptive_practice_history_${chapterId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

// ---------------------------------------------------------------------------
// Concept Scoring & Ranking
// ---------------------------------------------------------------------------

export function conceptScore(
  concept: AdaptiveConcept
): { score: number; source: ConceptRecommendation['scoreSource'] } | null {
  if (concept.practiceAttempts > 0) {
    return { score: concept.practicePercentage, source: 'concept-diagnostic' };
  }
  if (concept.diagnosticPercentage !== null) {
    return { score: concept.diagnosticPercentage, source: 'chapter-diagnostic' };
  }
  return null;
}

export function classifyConcept(concept: AdaptiveConcept): ConceptStrength {
  const scored = conceptScore(concept);
  if (!scored) return 'not-assessed';
  return scored.score < WEAK_BELOW_PERCENT ? 'weak' : 'understood';
}

function coversConcept(activity: PrayogshalaActivity, conceptId: string): boolean {
  const id = Number(conceptId);
  if (!Number.isFinite(id)) return false;
  return activity.concept_id === id || (activity.concept_ids ?? []).includes(id);
}

function isChapterWide(activity: PrayogshalaActivity): boolean {
  return (
    activity.topic_id === null &&
    activity.concept_id === null &&
    (activity.concept_ids ?? []).length === 0
  );
}

// ---------------------------------------------------------------------------
// Dynamic Topic-Specific Lab Generator
// ---------------------------------------------------------------------------

export function generateTopicSpecificLab(
  concept: AdaptiveConcept,
  analysis: AdaptivePracticeAnalysis | null | undefined,
  chapterName: string = 'Curriculum Chapter',
  subjectName: string = 'Science'
): TopicSpecificLabActivity {
  const score = analysis?.score?.percentage ?? conceptScore(concept)?.score ?? 45;
  const performanceLevel: PerformanceLevel =
    score < 50 ? 'struggling' : score < 70 ? 'developing' : 'proficient';

  const nameLower = (concept.name + ' ' + chapterName + ' ' + subjectName).toLowerCase();

  const difficultyLabel =
    performanceLevel === 'struggling'
      ? 'Foundational Guided Lab (Step-by-Step Scaffolding)'
      : performanceLevel === 'developing'
        ? 'Applied Variable Investigation (Intermediate Level)'
        : 'Advanced Extension Challenge (Mastery Level)';

  const learningGapNotice = analysis?.learningGaps?.length
    ? `Identified Gap in Adaptive Practice: Struggled with ${analysis.learningGaps.slice(0, 2).join(' & ')} (Practice Score: ${Math.round(score)}%). This lab demonstrates the physical principle step-by-step.`
    : `Diagnostic Performance: Scored ${Math.round(score)}% on this concept. This interactive lab clarifies the core mechanism through hands-on experimentation.`;

  // Water / Geography / Environment template
  if (nameLower.includes('water') || nameLower.includes('ocean') || nameLower.includes('resource') || nameLower.includes('rain')) {
    const isStruggling = performanceLevel === 'struggling';
    return {
      id: `lab-${concept.conceptId}`,
      conceptId: concept.conceptId,
      conceptName: concept.name,
      chapterName,
      subjectName,
      title: `Virtual Laboratory: Physical Modeling of ${concept.name}`,
      objective: `Investigate how water volume, salinity separation, and consumption rate affect available freshwater supply.`,
      performanceLevel,
      difficultyLabel,
      learningGapNotice,
      estimatedMinutes: isStruggling ? 10 : 15,
      materials: [
        { name: '1000 mL Graduated Cylinder', purpose: 'Calibrated measure for global total reservoir volume.' },
        { name: 'Digital Salinity Refractometer', purpose: 'Measures dissolved salt parts-per-thousand (ppt).' },
        { name: 'Centrifugal Filtration Core', purpose: 'Separates sediment and particulate matter from runoff.' },
        { name: 'Digital Flow Valve', purpose: 'Adjusts extraction rate and monitors aquifer drawdown.' },
      ],
      procedureSteps: [
        { step: 1, instruction: 'Calibrate the virtual reservoir to 1000 mL representing 100% of global water distribution.', tip: 'Notice that 972 mL represents ocean saltwater.' },
        { step: 2, instruction: 'Adjust the Extraction Demand slider to test aquifer drawdown and usable freshwater remaining.', tip: 'Observe how rapidly accessible surface water drops under high demand.' },
        { step: 3, instruction: 'Compare the simulated rate of precipitation recharge against extraction consumption.', tip: 'Equilibrium occurs only when extraction is less than or equal to recharge.' },
        { step: 4, instruction: 'Record the salinity reading and observe why ocean desalination requires external energy input.' },
      ],
      primaryVariable: {
        id: 'extraction_rate',
        label: 'Human Extraction Demand',
        unit: 'L/day per capita',
        min: 50,
        max: 500,
        step: 25,
        defaultValue: isStruggling ? 150 : 250,
      },
      secondaryVariable: {
        id: 'recharge_rate',
        label: 'Seasonal Precipitation Recharge',
        unit: 'mm/year',
        min: 100,
        max: 1200,
        step: 50,
        defaultValue: 600,
      },
      computeObservation: (extraction, recharge = 600) => {
        const stress = Math.round((extraction / (recharge / 2)) * 100);
        const usableFreshwaterPercent = Math.max(0.5, +(2.5 - (extraction * 0.003)).toFixed(2));
        const statusColor = stress > 130 ? 'rose' : stress > 85 ? 'amber' : 'emerald';
        return {
          valueDisplay: `Usable Freshwater Remaining: ${usableFreshwaterPercent}% | Basin Stress: ${stress}%`,
          observationText:
            stress > 100
              ? `Critical Over-extraction: At ${extraction} L/day, extraction outpaces replenishment (${recharge} mm/yr). Groundwater reserves decrease by ${stress - 100}% annually.`
              : `Sustainable Balance: At ${extraction} L/day, natural rainfall recharge maintains steady groundwater table equilibrium.`,
          statusColor,
          scientificPrinciple: `Only ~2.5% of Earth's water is freshwater, and less than 1% is accessible surface water. The hydrologic cycle operates as a closed system where extraction rates directly determine regional water security.`,
          visualMetrics: [
            { label: 'Saltwater Reserves (Oceans)', percent: 97.2, color: 'bg-sky-600' },
            { label: 'Glaciers & Ice Caps', percent: 2.1, color: 'bg-cyan-300' },
            { label: 'Accessible Liquid Freshwater', percent: usableFreshwaterPercent, color: statusColor === 'rose' ? 'bg-rose-500' : 'bg-emerald-500' },
          ],
        };
      },
      realWorldDemonstration: {
        scenarioTitle: 'Real-World Case Study: River Basin Depletion & Drip Irrigation',
        realWorldExample:
          'In municipal water basins, excessive flood irrigation depletes aquifers faster than monsoonal percolation can recharge them. Modern precision drip irrigation meters water directly to plant root zones, cutting demand by 45%.',
        whyMisconceptionOccurs:
          'In Adaptive Practice, learners often assume that because Earth is 71% water-covered, water cannot become scarce. The physical experiment proves that 97% is saline and inaccessible without massive energy desalination.',
        practicalTakeaway:
          'Freshwater is a finite renewable resource constrained by local recharge rates, not total planetary surface moisture.',
      },
      verificationQuestions: [
        {
          id: 'v1',
          question: 'Based on the experiment, what happens to the groundwater table when extraction exceeds natural rainfall recharge?',
          options: [
            { id: 'a', label: 'Groundwater table depletes and regional water stress increases', isCorrect: true, explanation: 'Correct! When withdrawal rate exceeds percolation recharge, net storage drops continuously.' },
            { id: 'b', label: 'Ocean water automatically flows in to refill freshwater wells with pure drinking water', isCorrect: false, explanation: 'Incorrect: Ocean saltwater intrusion contaminates coastal aquifers rather than replenishing drinking water.' },
            { id: 'c', label: 'Total global water quantity increases', isCorrect: false, explanation: 'Incorrect: Earth is a closed hydrologic system; water changes state and location, but total mass is conserved.' },
          ],
        },
        {
          id: 'v2',
          question: 'What percentage of Earth’s total water is readily accessible as liquid freshwater in rivers, lakes, and shallow aquifers?',
          options: [
            { id: 'a', label: 'Approximately 50%', isCorrect: false, explanation: 'Incorrect: Over 97% is saltwater in oceans.' },
            { id: 'b', label: 'Less than 1%', isCorrect: true, explanation: 'Correct! Out of the 2.5% total freshwater, nearly 70% is frozen in glaciers, leaving under 1% accessible.' },
            { id: 'c', label: 'Around 25%', isCorrect: false, explanation: 'Incorrect: 25% is vastly higher than actual available surface water.' },
          ],
        },
      ],
      prayogshalaActivity: createSyntheticPrayogshalaActivity(concept, chapterName, subjectName, 'calculator', {
        variables: [
          { id: 'extraction', label: 'Extraction Demand', unit: 'L/day', min: 50, max: 500, step: 25, default: 200 },
        ],
        outputs: [
          { id: 'stress', label: 'Water Stress', unit: '%', formula: 'extraction * 0.4', primary: true },
        ],
      }),
    };
  }

  // Electricity / Physics / Motion template
  if (nameLower.includes('electric') || nameLower.includes('circuit') || nameLower.includes('force') || nameLower.includes('motion') || nameLower.includes('light') || nameLower.includes('energy') || nameLower.includes('heat')) {
    const isStruggling = performanceLevel === 'struggling';
    return {
      id: `lab-${concept.conceptId}`,
      conceptId: concept.conceptId,
      conceptName: concept.name,
      chapterName,
      subjectName,
      title: `Virtual Physics Lab: Experimental Analysis of ${concept.name}`,
      objective: `Determine the exact relationship between the independent variable and system response through live measurement.`,
      performanceLevel,
      difficultyLabel,
      learningGapNotice,
      estimatedMinutes: isStruggling ? 10 : 14,
      materials: [
        { name: 'Regulated DC Power / Driving Force Module', purpose: 'Applies calibrated stimulus to the test specimen.' },
        { name: 'Digital Multimeter & High-Precision Sensor', purpose: 'Measures live circuit current / displacement in real time.' },
        { name: 'Variable Rheostat / Calibrated Load', purpose: 'Introduces resistance or opposing force.' },
        { name: 'Safety Grounding Switch', purpose: 'Prevents circuit overload and thermal breakdown.' },
      ],
      procedureSteps: [
        { step: 1, instruction: 'Mount the test component in the measurement jig and connect sensor leads.', tip: 'Verify polarity before powering on.' },
        { step: 2, instruction: 'Adjust the Primary Input variable and observe the immediate change on the digital readout.', tip: 'Notice whether the response changes linearly or exponentially.' },
        { step: 3, instruction: 'Vary the Secondary Resistance factor to observe opposing damping effects.', tip: 'Increasing resistance reduces throughput according to inverse proportion.' },
        { step: 4, instruction: 'Record data points to confirm the governing physical law.' },
      ],
      primaryVariable: {
        id: 'applied_stimulus',
        label: 'Applied Voltage / Driving Force',
        unit: 'V (Volts) / N',
        min: 1,
        max: 24,
        step: 1,
        defaultValue: isStruggling ? 6 : 12,
      },
      secondaryVariable: {
        id: 'system_resistance',
        label: 'Circuit Resistance / Friction Load',
        unit: 'Ω (Ohms) / kg',
        min: 2,
        max: 40,
        step: 2,
        defaultValue: 10,
      },
      computeObservation: (stimulus, resistance = 10) => {
        const response = +(stimulus / Math.max(1, resistance)).toFixed(2);
        const powerDissipation = +(stimulus * response).toFixed(1);
        const statusColor = response > 3 ? 'rose' : response > 1.5 ? 'emerald' : 'sky';
        return {
          valueDisplay: `Resulting Flow / Current: ${response} A | Energy Dissipation: ${powerDissipation} W`,
          observationText: `At ${stimulus} V across ${resistance} Ω, electrons experience a potential gradient producing ${response} Amperes of flow. Doubling voltage doubles the current, demonstrating direct proportionality.`,
          statusColor,
          scientificPrinciple: `Governed by fundamental physical law (I = V / R). Flow rate is directly proportional to applied driving potential and inversely proportional to resistance.`,
          visualMetrics: [
            { label: 'Driving Potential (V)', percent: Math.min(100, (stimulus / 24) * 100), color: 'bg-amber-500' },
            { label: 'Measured Current (A)', percent: Math.min(100, (response / 4) * 100), color: 'bg-emerald-500' },
            { label: 'System Resistance (Ω)', percent: Math.min(100, (resistance / 40) * 100), color: 'bg-indigo-500' },
          ],
        };
      },
      realWorldDemonstration: {
        scenarioTitle: 'Real-World Demonstration: Household Appliances & Circuit Breakers',
        realWorldExample:
          'When you connect too many high-wattage heating appliances to one extension strip, total resistance drops in parallel, drawing excessive current. The bi-metallic strip in a circuit breaker heats up and trips to prevent an electrical fire.',
        whyMisconceptionOccurs:
          'Students often confuse potential (Voltage) with flow (Current), or believe resistors "consume" or destroy electrons. The physical lab shows electrons circulate unchanged in number while energy is transferred.',
        practicalTakeaway:
          'Current is the rate of charge flow determined jointly by the push (voltage) and the restriction (resistance).',
      },
      verificationQuestions: [
        {
          id: 'v1',
          question: 'If you double the driving voltage while keeping resistance constant, what happens to the measured current?',
          options: [
            { id: 'a', label: 'The current doubles', isCorrect: true, explanation: 'Correct! By Ohm’s Law (I = V/R), current is directly proportional to voltage.' },
            { id: 'b', label: 'The current drops to zero', isCorrect: false, explanation: 'Incorrect: Higher potential push increases charge flow rate.' },
            { id: 'c', label: 'The current remains unchanged', isCorrect: false, explanation: 'Incorrect: Current only stays constant if resistance increases proportionally.' },
          ],
        },
        {
          id: 'v2',
          question: 'If the resistance of a circuit is significantly increased with the same battery connected, what is observed?',
          options: [
            { id: 'a', label: 'Current flow decreases proportionally', isCorrect: true, explanation: 'Correct! Higher resistance opposes electron drift, reducing current flow.' },
            { id: 'b', label: 'Battery voltage drops to zero immediately', isCorrect: false, explanation: 'Incorrect: The battery maintains its chemical potential difference.' },
            { id: 'c', label: 'Current flow increases indefinitely', isCorrect: false, explanation: 'Incorrect: Opposing resistance restricts current.' },
          ],
        },
      ],
      prayogshalaActivity: createSyntheticPrayogshalaActivity(concept, chapterName, subjectName, 'calculator', {
        variables: [
          { id: 'voltage', label: 'Voltage', unit: 'V', min: 1, max: 24, step: 1, default: 12 },
          { id: 'resistance', label: 'Resistance', unit: 'Ω', min: 2, max: 40, step: 2, default: 10 },
        ],
        outputs: [
          { id: 'current', label: 'Current', unit: 'A', formula: 'voltage / resistance', primary: true },
        ],
      }),
    };
  }

  // Biology / Life Sciences / Plants / Cell template
  if (nameLower.includes('plant') || nameLower.includes('cell') || nameLower.includes('bio') || nameLower.includes('photo') || nameLower.includes('leaf') || nameLower.includes('organism') || nameLower.includes('nutrient')) {
    const isStruggling = performanceLevel === 'struggling';
    return {
      id: `lab-${concept.conceptId}`,
      conceptId: concept.conceptId,
      conceptName: concept.name,
      chapterName,
      subjectName,
      title: `Virtual Biology Lab: Microscopic & Functional Investigation of ${concept.name}`,
      objective: `Observe how environmental factors regulate cellular biological activity in real time.`,
      performanceLevel,
      difficultyLabel,
      learningGapNotice,
      estimatedMinutes: isStruggling ? 10 : 15,
      materials: [
        { name: 'Compound Microscope with Digital Sensor', purpose: 'High magnification viewing of cellular membranes and organelles.' },
        { name: 'Gas Inverted Burette', purpose: 'Collects and measures oxygen / carbon dioxide displacement bubbles.' },
        { name: 'Variable Spectrum Light Illuminator', purpose: 'Controls photon wavelength and lux intensity.' },
        { name: 'Dilute Iodine & Methylene Blue Stains', purpose: 'Stains starch granules and nuclei for visual contrast.' },
      ],
      procedureSteps: [
        { step: 1, instruction: 'Mount the live biological specimen in a drop of water on a clean glass slide and cover with coverslip.', tip: 'Avoid air bubbles by lowering coverslip at a 45 degree angle.' },
        { step: 2, instruction: 'Increase the Environmental Stimulus slider and count the rate of cellular metabolic bubbles produced per minute.', tip: 'Biological reactions accelerate up to an optimum point.' },
        { step: 3, instruction: 'Introduce the secondary variable (temperature or solute concentration) to observe osmosis or denaturation.', tip: 'Extreme conditions denature protein enzymes.' },
        { step: 4, instruction: 'Apply contrast stain and record the biological rate of reaction on the digital readout.' },
      ],
      primaryVariable: {
        id: 'stimulus_intensity',
        label: 'Light / Environmental Stimulus Intensity',
        unit: '% lux / level',
        min: 10,
        max: 100,
        step: 10,
        defaultValue: isStruggling ? 30 : 60,
      },
      secondaryVariable: {
        id: 'ambient_temp',
        label: 'Ambient Temperature',
        unit: '°C',
        min: 10,
        max: 60,
        step: 5,
        defaultValue: 25,
      },
      computeObservation: (intensity, temp = 25) => {
        // Bell-curve thermal optimum around 30-35 C
        const tempFactor = temp > 45 ? Math.max(0, 1 - (temp - 45) * 0.06) : Math.min(1, temp / 30);
        const bubblesPerMin = Math.round((intensity * 0.8) * tempFactor);
        const statusColor = temp > 45 ? 'rose' : bubblesPerMin > 35 ? 'emerald' : 'sky';
        return {
          valueDisplay: `Metabolic Gas Output: ${bubblesPerMin} bubbles/min | Cellular Efficiency: ${Math.round(tempFactor * 100)}%`,
          observationText:
            temp > 45
              ? `Thermal Stress: At ${temp}°C, intracellular enzymes begin denaturing, reducing metabolic output to ${bubblesPerMin} bubbles/min despite high light intensity.`
              : `Active Synthesis: Specimen exhibits steady cellular conversion producing ${bubblesPerMin} bubbles/min under ${intensity}% illumination at ${temp}°C.`,
          statusColor,
          scientificPrinciple: `Biological metabolic reactions depend on enzyme kinetics. Rate increases with reactant availability (light/substrate) until reaching enzyme saturation or thermal denaturation limits.`,
          visualMetrics: [
            { label: 'Stimulus Level', percent: intensity, color: 'bg-emerald-500' },
            { label: 'Enzyme Activity Index', percent: Math.round(tempFactor * 100), color: statusColor === 'rose' ? 'bg-rose-500' : 'bg-cyan-500' },
            { label: 'Gas Bubble Production', percent: Math.min(100, bubblesPerMin * 2), color: 'bg-purple-500' },
          ],
        };
      },
      realWorldDemonstration: {
        scenarioTitle: 'Real-World Demonstration: Greenhouse Agriculture & Crop Yield',
        realWorldExample:
          'Commercial greenhouses regulate both light duration and thermal ventilation. Even in bright mid-summer sunlight, without ventilation fans cooling the greenhouse below 38°C, plant enzymes stall and fruit yields plummet.',
        whyMisconceptionOccurs:
          'In practice tests, students often think increasing temperature always speeds up biological processes. The experiment visually demonstrates that live tissue contains heat-sensitive enzymes with strict upper thermal boundaries.',
        practicalTakeaway:
          'Living systems operate within regulated homeostatic ranges where chemical rates depend on enzyme structure integrity.',
      },
      verificationQuestions: [
        {
          id: 'v1',
          question: 'What happens to the cellular reaction rate when temperature increases past 45°C in the experiment?',
          options: [
            { id: 'a', label: 'Rate drops sharply due to enzyme denaturation', isCorrect: true, explanation: 'Correct! Extreme heat alters protein structure, destroying active enzyme sites.' },
            { id: 'b', label: 'Rate increases to infinity', isCorrect: false, explanation: 'Incorrect: Living cells cannot sustain arbitrary thermal acceleration.' },
            { id: 'c', label: 'Light absorption immediately converts into sound', isCorrect: false, explanation: 'Incorrect: Energy remains thermal/chemical.' },
          ],
        },
        {
          id: 'v2',
          question: 'What does the production of bubbles directly indicate in the photosynthetic experiment?',
          options: [
            { id: 'a', label: 'Oxygen gas generated as a byproduct of water photolysis', isCorrect: true, explanation: 'Correct! Chloroplasts split water using light energy, releasing pure oxygen gas.' },
            { id: 'b', label: 'Carbon dioxide gas being completely destroyed', isCorrect: false, explanation: 'Incorrect: Carbon dioxide is fixed into glucose, not boiled into gas.' },
            { id: 'c', label: 'Water boiling into steam at room temperature', isCorrect: false, explanation: 'Incorrect: Water does not boil at room temperature.' },
          ],
        },
      ],
      prayogshalaActivity: createSyntheticPrayogshalaActivity(concept, chapterName, subjectName, 'calculator', {
        variables: [
          { id: 'intensity', label: 'Light Intensity', unit: '%', min: 10, max: 100, step: 10, default: 50 },
        ],
        outputs: [
          { id: 'bubbles', label: 'Gas Output', unit: 'bpm', formula: 'intensity * 0.8', primary: true },
        ],
      }),
    };
  }

  // Mathematics / Numbers / Algebra / Geometry template
  const isStruggling = performanceLevel === 'struggling';
  return {
    id: `lab-${concept.conceptId}`,
    conceptId: concept.conceptId,
    conceptName: concept.name,
    chapterName,
    subjectName,
    title: `Interactive Mathematics Lab: Visual Investigation of ${concept.name}`,
    objective: `Manipulate visual models and geometric parameters to observe direct mathematical relationships and rules.`,
    performanceLevel,
    difficultyLabel,
    learningGapNotice,
    estimatedMinutes: isStruggling ? 8 : 12,
    materials: [
      { name: 'Dynamic Geometric Coordinate Grid', purpose: 'Visual plane displaying coordinates, shapes, and measurements.' },
      { name: 'Calibrated Number Vector Line', purpose: 'Tracks positive and negative directional displacement.' },
      { name: 'Virtual Balance Scale & Unit Weights', purpose: 'Demonstrates algebraic equality conservation across equations.' },
      { name: 'Fraction Bar Decomposition Matrix', purpose: 'Splits whole numbers into proportional geometric segments.' },
    ],
    procedureSteps: [
      { step: 1, instruction: 'Initialize the mathematical model to the baseline test parameters.', tip: 'Observe how visual units correspond directly to numerical terms.' },
      { step: 2, instruction: 'Adjust the Input Value slider and watch the dynamic balance scale update.', tip: 'Both sides of an equality must undergo identical operations to maintain equilibrium.' },
      { step: 3, instruction: 'Test positive vs negative inputs to observe directional sign rules.', tip: 'Subtracting a negative value corresponds to moving in the positive direction.' },
      { step: 4, instruction: 'Compare the geometric area or vector magnitude with your algebraic calculation.' },
    ],
    primaryVariable: {
      id: 'operand_a',
      label: 'Input Value / Scale Factor (X)',
      unit: 'units',
      min: -10,
      max: 20,
      step: 1,
      defaultValue: isStruggling ? 4 : 8,
    },
    secondaryVariable: {
      id: 'operand_b',
      label: 'Multiplier / Offset Factor (Y)',
      unit: 'units',
      min: -5,
      max: 10,
      step: 1,
      defaultValue: 3,
    },
    computeObservation: (x, y = 3) => {
      const product = x * y;
      const sum = x + y;
      const statusColor = product < 0 ? 'amber' : 'emerald';
      return {
        valueDisplay: `Resulting Value: ${product} | Cumulative Sum: ${sum}`,
        observationText:
          x < 0 && y > 0
            ? `Directional Inversion: Multiplying negative input (${x}) by positive scalar (${y}) extends vector along the negative axis to ${product}.`
            : x < 0 && y < 0
              ? `Double Negation: Two negative values (${x} × ${y}) invert direction twice, producing a positive magnitude of +${product}.`
              : `Proportional Scaling: Input value ${x} scaled by factor ${y} produces an expanded measure of ${product} units.`,
        statusColor,
        scientificPrinciple: `Mathematical operations represent spatial transformations and balance conservation. Multiplying or dividing by negative numbers inverts geometric orientation across the origin.`,
        visualMetrics: [
          { label: 'Input Variable (X)', percent: Math.min(100, Math.abs(x) * 5), color: x < 0 ? 'bg-amber-500' : 'bg-indigo-500' },
          { label: 'Scalar Factor (Y)', percent: Math.min(100, Math.abs(y) * 10), color: 'bg-cyan-500' },
          { label: 'Computed Magnitude', percent: Math.min(100, Math.abs(product) * 2), color: statusColor === 'amber' ? 'bg-amber-600' : 'bg-emerald-600' },
        ],
      };
    },
    realWorldDemonstration: {
      scenarioTitle: 'Real-World Application: Elevation, Financial Ledgers & Temperature Scales',
      realWorldExample:
        'Submarines calculate depth below sea level as negative meters (-150 m). Ascending by 50 meters (-150 + 50 = -100 m) decreases the depth value, exactly demonstrating integer addition.',
      whyMisconceptionOccurs:
        'In practice drills, students frequently confuse addition of negative integers with multiplication, or forget that multiplying two negative numbers yields a positive outcome.',
      practicalTakeaway:
        'Numbers are coordinates of position and magnitude. Spatial balance rules guarantee consistent algebraic results.',
    },
    verificationQuestions: [
      {
        id: 'v1',
        question: 'When an input vector of -4 is multiplied by a positive scalar factor of +3, what is the resulting value?',
        options: [
          { id: 'a', label: '-12', isCorrect: true, explanation: 'Correct! The negative sign indicates reversal of direction along the number scale (-4 × 3 = -12).' },
          { id: 'b', label: '+12', isCorrect: false, explanation: 'Incorrect: A negative value multiplied by a positive value stays negative.' },
          { id: 'c', label: '-1', isCorrect: false, explanation: 'Incorrect: This confuses addition (-4 + 3 = -1) with multiplication.' },
        ],
      },
      {
        id: 'v2',
        question: 'What is the physical meaning of keeping an equation in balance when performing operations on both sides?',
        options: [
          { id: 'a', label: 'Applying the identical operation to both sides preserves the true equality', isCorrect: true, explanation: 'Correct! Like a physical two-pan balance scale, doing the same to both pans keeps it level.' },
          { id: 'b', label: 'Changing only one side creates a more accurate formula', isCorrect: false, explanation: 'Incorrect: Modifying only one side breaks equality.' },
          { id: 'c', label: 'Equal signs only work for positive whole numbers', isCorrect: false, explanation: 'Incorrect: Equalities hold across all real numbers.' },
        ],
      },
    ],
    prayogshalaActivity: createSyntheticPrayogshalaActivity(concept, chapterName, subjectName, 'calculator', {
      variables: [
        { id: 'val_x', label: 'Input X', unit: 'units', min: -10, max: 20, step: 1, default: 5 },
        { id: 'val_y', label: 'Scalar Y', unit: 'units', min: -5, max: 10, step: 1, default: 2 },
      ],
      outputs: [
        { id: 'product', label: 'Product Result', unit: 'units', formula: 'val_x * val_y', primary: true },
      ],
    }),
  };
}

function createSyntheticPrayogshalaActivity(
  concept: AdaptiveConcept,
  chapterName: string,
  subjectName: string,
  engineType: string,
  params: Record<string, unknown>
): PrayogshalaActivity {
  const numericId = Math.abs(Number(concept.conceptId) || 9999);
  return {
    id: numericId,
    chapter_id: 1,
    standard_id: 1,
    subject_id: 1,
    topic_id: null,
    topic_name: null,
    concept_id: numericId,
    concept_name: concept.name,
    title: `Investigation of ${concept.name}`,
    activity_type: 'experiment',
    activity_type_label: 'Virtual Laboratory',
    description: `Hands-on simulation exploring ${concept.name} within ${chapterName}.`,
    objective: `Examine the relationships governing ${concept.name} through interactive measurement.`,
    materials_required: ['Calibrated Measurement Apparatus', 'Digital Sensor Display', 'Variable Control Module'],
    procedure_steps: [
      'Initialize test parameters to reference values.',
      'Adjust the primary independent variable across the test range.',
      'Record sensor response and compare with theoretical predictions.',
    ],
    observation: 'Output values adjust proportionally to input adjustments.',
    result: `Direct experimentation confirms the operational principle of ${concept.name}.`,
    safety_instructions: null,
    teacher_instructions: null,
    student_instructions: 'Manipulate the sliders to test how varying one factor changes the system.',
    estimated_minutes: 15,
    resources: [],
    slug: `exp-${concept.conceptId}`,
    status: 'published',
    generation_status: 'ready',
    generation_version: 1,
    generated_at: new Date().toISOString(),
    generation_error: null,
    generation_error_code: null,
    generation_retry_after: null,
    concept_ids: [numericId],
    concept_names: [concept.name],
    source_refs: null,
    lab_config: {
      version: 1,
      simulation: {
        type: engineType,
        params,
      },
      steps: {
        mission: { scenario: `You are investigating ${concept.name} in ${chapterName}.`, task: 'Discover the governing relationship.' },
        predict: { question: 'What happens when the input parameter is doubled?', options: [{ id: 'opt1', label: 'The response doubles', when: '1' }] },
        do: { instructions: ['Set values using the sliders.', 'Check the primary output.'] },
        observe: { prompt: 'Take note of the calculated output.' },
        explain: { text: `The value changes in direct accordance with the governing formula for ${concept.name}.` },
        concept: { text: `Core principle: ${concept.name} defines how inputs transform into system outcomes.` },
        apply: { question: 'How can this be applied in practice?', options: [{ id: 'app1', label: 'By controlling the input parameter to achieve the desired response', correct: true }] },
        reflect: { prompts: ['What pattern did you notice between input and output?'] },
      },
    },
    show_hide: 1,
    sort_order: 1,
    editable: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Explanation Lab Plan Builder
// ---------------------------------------------------------------------------

export function buildExplanationLabPlan(
  concepts: readonly AdaptiveConcept[],
  experiments: readonly PrayogshalaActivity[],
  hasDiagnostic: boolean,
  chapterName: string = 'Curriculum Chapter',
  subjectName: string = 'Science',
  chapterId?: string
): ExplanationLabPlan {
  const chapterWide = experiments.filter(isChapterWide);
  const recommendations: ConceptRecommendation[] = [];
  let understoodCount = 0;
  let notAssessedCount = 0;
  let anyResult = hasDiagnostic;

  const activeAnalysis = chapterId ? getAdaptivePracticeAnalysis(chapterId) : null;
  const practiceHistory = chapterId ? getAdaptivePracticeHistory(chapterId) : {};

  for (const concept of concepts) {
    const sessionAnalysis = activeAnalysis?.conceptId === concept.conceptId
      ? activeAnalysis
      : practiceHistory[concept.conceptId] ?? null;

    let score: number;
    let scoreSource: ConceptRecommendation['scoreSource'];

    if (sessionAnalysis) {
      score = sessionAnalysis.score.percentage;
      scoreSource = 'adaptive-practice';
      anyResult = true;
    } else {
      const scored = conceptScore(concept);
      if (!scored) {
        notAssessedCount += 1;
        continue;
      }
      anyResult = true;
      score = scored.score;
      scoreSource = scored.source;
    }

    if (score >= WEAK_BELOW_PERCENT && !sessionAnalysis?.wrongQuestions?.length) {
      understoodCount += 1;
      continue;
    }

    const matched = experiments.filter((activity) => coversConcept(activity, concept.conceptId));
    const generatedLab = generateTopicSpecificLab(concept, sessionAnalysis, chapterName, subjectName);

    const labExperiments = matched.length > 0 ? matched : [generatedLab.prayogshalaActivity, ...chapterWide];

    recommendations.push({
      concept,
      score,
      scoreSource,
      experiments: labExperiments,
      chapterWide: matched.length === 0 && chapterWide.length > 0,
      generatedLab,
    });
  }

  recommendations.sort((a, b) => {
    if (activeAnalysis) {
      if (a.concept.conceptId === activeAnalysis.conceptId) return -1;
      if (b.concept.conceptId === activeAnalysis.conceptId) return 1;
    }
    return a.score - b.score;
  });

  // If the active practice analysis was not found in the concepts list (e.g. mock or new concept),
  // synthesize and prepend it so the student's exact practice results are always front and center
  if (activeAnalysis && !recommendations.some((r) => r.concept.conceptId === activeAnalysis.conceptId)) {
    const syntheticConcept: AdaptiveConcept = {
      conceptId: activeAnalysis.conceptId,
      name: activeAnalysis.conceptName,
      diagnosticAttempts: 1,
      diagnosticPercentage: activeAnalysis.score.percentage,
      practiceAttempts: 1,
      practicePercentage: activeAnalysis.score.percentage,
      isClearedToHard: false,
      isHardPassed: false,
      isDiagnosticPassed: activeAnalysis.score.percentage >= 70,
    };
    const generatedLab = generateTopicSpecificLab(syntheticConcept, activeAnalysis, chapterName, subjectName);
    recommendations.unshift({
      concept: syntheticConcept,
      score: activeAnalysis.score.percentage,
      scoreSource: 'adaptive-practice',
      experiments: [generatedLab.prayogshalaActivity],
      chapterWide: false,
      generatedLab,
    });
  }

  // If no weak concepts were found from past scores, but we have concepts:
  // generate a lab for the lowest scoring or first concept so student can always explore!
  if (recommendations.length === 0 && concepts.length > 0) {
    const targetConcept = concepts[0];
    const generatedLab = generateTopicSpecificLab(targetConcept, activeAnalysis, chapterName, subjectName);
    recommendations.push({
      concept: targetConcept,
      score: targetConcept.practicePercentage || targetConcept.diagnosticPercentage || 100,
      scoreSource: targetConcept.practiceAttempts > 0 ? 'concept-diagnostic' : 'chapter-diagnostic',
      experiments: [generatedLab.prayogshalaActivity],
      chapterWide: false,
      generatedLab,
    });
  }

  return {
    hasResults: anyResult || Boolean(activeAnalysis) || recommendations.length > 0,
    recommendations,
    understoodCount,
    notAssessedCount,
    activeAnalysis,
  };
}
