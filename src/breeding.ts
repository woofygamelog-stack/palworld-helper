export type Gender="WILDCARD"|"MALE"|"FEMALE";
export type BreedingRow=[number,number,number,Gender,Gender];
export function findBreedingResult(rows:BreedingRow[],a:number,b:number,genderA:Gender,genderB:Gender):number|undefined{
  const exact=rows.find(row=>(row[0]===a&&row[1]===b&&row[3]===genderA&&row[4]===genderB)||(row[0]===b&&row[1]===a&&row[3]===genderB&&row[4]===genderA));
  if(exact)return exact[2];
  if(genderA!=="WILDCARD"&&genderB!=="WILDCARD")return rows.find(row=>((row[0]===a&&row[1]===b)||(row[0]===b&&row[1]===a))&&row[3]==="WILDCARD"&&row[4]==="WILDCARD")?.[2];
  return undefined;
}
export function findParentPairs(rows:BreedingRow[],target:number):BreedingRow[]{return rows.filter(row=>row[2]===target)}
