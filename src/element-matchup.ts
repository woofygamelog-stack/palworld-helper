export type ElementOutcome="strong"|"weak"|"neutral";

export type ElementMatchupRelation={attacker:string;defender:string};
export type NumericElementMultipliers=Record<ElementOutcome,number>;
export type DualElementCombinationRule={operation:"multiply"};
export type ElementMatchupRules={
  numericMultipliers:NumericElementMultipliers|null;
  dualElement:DualElementCombinationRule|null;
};

export type ElementMatchupComponent={
  defender:string;
  outcome:ElementOutcome;
  multiplier:number|null;
};

export type ElementMatchupEvaluation={
  attacker:string;
  components:ElementMatchupComponent[];
  combinedMultiplier:number|null;
  numericMultipliersVerified:boolean;
  dualElementRuleVerified:boolean;
};

export function qualitativeElementOutcome(attacker:string,defender:string,relations:readonly ElementMatchupRelation[]):ElementOutcome{
  if(relations.some(relation=>relation.attacker===attacker&&relation.defender===defender))return "strong";
  if(relations.some(relation=>relation.attacker===defender&&relation.defender===attacker))return "weak";
  return "neutral";
}

export function evaluateElementMatchup(attacker:string,defenders:readonly string[],relations:readonly ElementMatchupRelation[],rules:ElementMatchupRules):ElementMatchupEvaluation{
  if(!attacker)throw new Error("An attacking element is required");
  if(defenders.length<1||defenders.length>2)throw new RangeError("One or two defending elements are required");
  if(defenders.some(defender=>!defender))throw new Error("Defending elements cannot be empty");
  if(new Set(defenders).size!==defenders.length)throw new Error("Defending elements must be unique");
  const components=defenders.map(defender=>{
    const outcome=qualitativeElementOutcome(attacker,defender,relations);
    return {defender,outcome,multiplier:rules.numericMultipliers?.[outcome]??null};
  });
  const combinedMultiplier=components.length===1
    ?components[0].multiplier
    :rules.dualElement?.operation==="multiply"&&components.every(component=>component.multiplier!==null)
      ?components.reduce((total,component)=>total*(component.multiplier as number),1)
      :null;
  return {
    attacker,
    components,
    combinedMultiplier,
    numericMultipliersVerified:rules.numericMultipliers!==null,
    dualElementRuleVerified:components.length===1||rules.dualElement!==null
  };
}
