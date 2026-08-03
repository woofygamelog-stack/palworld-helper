export function createLazyModule<Module>(load:()=>Promise<Module>,onReady:(loaded:Module)=>void=()=>{}){
  let value:Module|undefined,pending:Promise<Module>|undefined;
  return {
    get value(){return value},
    ready(){return value!==undefined},
    load(){
      return pending??=load().then(loaded=>{
        value=loaded;
        onReady(loaded);
        return loaded;
      });
    }
  };
}
