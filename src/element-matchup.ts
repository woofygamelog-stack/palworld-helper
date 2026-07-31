export type ElementOutcome="strong"|"weak"|"neutral";
export type ElementWeakCount=-2|-1|0|1|2;

export type ElementMatchupRelation={attacker:string;defender:string};
export type NumericElementMultipliers=Record<ElementOutcome,number>;
export type DualElementCombinationRule={
  operation:"sum-relation-scores";
  sameElementResistance:"all-except-neutral";
  neutralAttackIsNeverWeak:true;
  multipliersByWeakCount:Record<`${ElementWeakCount}`,number>;
};
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
  if(attacker==="neutral")return "neutral";
  if(attacker===defender&&attacker!=="neutral")return "weak";
  if(relations.some(relation=>relation.attacker===defender&&relation.defender===attacker))return "weak";
  return "neutral";
}

function outcomeScore(outcome:ElementOutcome):ElementWeakCount{
  return outcome==="strong"?1:outcome==="weak"?-1:0;
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
  const weakCount=components.reduce<number>((total,component)=>total+outcomeScore(component.outcome),0) as ElementWeakCount;
  if(rules.numericMultipliers&&rules.dualElement){
    const lookup=rules.dualElement.multipliersByWeakCount;
    if(rules.dualElement.sameElementResistance!=="all-except-neutral"||rules.dualElement.neutralAttackIsNeverWeak!==true||lookup["-1"]!==rules.numericMultipliers.weak||lookup["0"]!==rules.numericMultipliers.neutral||lookup["1"]!==rules.numericMultipliers.strong){
      throw new Error("Single-element multipliers must agree with the dual-element weakCount lookup");
    }
  }
  const combinedMultiplier=components.length===1
    ?components[0].multiplier
    :rules.numericMultipliers!==null&&rules.dualElement?.operation==="sum-relation-scores"
      ?rules.dualElement.multipliersByWeakCount[String(weakCount) as `${ElementWeakCount}`]
      :null;
  return {
    attacker,
    components,
    combinedMultiplier,
    numericMultipliersVerified:rules.numericMultipliers!==null,
    dualElementRuleVerified:components.length===1||(rules.numericMultipliers!==null&&rules.dualElement!==null)
  };
}
