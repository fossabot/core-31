import {ScriptEngine} from './Engine';
import {env as ogEnv} from '../ctx/env';
import {state as ogState} from '../ctx/state';
import {nonce} from '../ctx/nonce';
import {Script as ogScript, type ScriptProps} from './Script';

let active_engine:ScriptEngine|null = null;

export function setActiveScriptEngine <T extends ScriptEngine|null> (engine:T):T {
    active_engine = engine;
    return engine;
}

export function getActiveScriptEngine () {
    return active_engine;
}

/**
 * MARK: Script Factory
 */

type ScriptConfig = {
    atomic?:boolean;
};

export function createScript<
  Env extends Record<string, any> = Record<string, any>,
  TFRelay extends Record<string, unknown> = Record<string, unknown>,
  TFStore extends Record<string, unknown> = Record<string, unknown>
> (config:ScriptConfig = {}) {
    let mountPath:string|null = null;
    const isAtomic = 'atomic' in config && config.atomic === true;

    /* Env proxy */
    const env = <K extends keyof Env> (key:K) => ogEnv<Env[K]>(key as string);

    /* State proxy */
    const state = <T = unknown, K extends string = string> (key:K) => ogState<T>(key);

    /* Script proxy */
    const Script = <TFData = undefined> (props:ScriptProps<TFData, TFRelay, TFStore>) => {
        if (!active_engine) setActiveScriptEngine(new ScriptEngine());
        if (isAtomic) active_engine!.setAtomic(config.atomic!);
        return ogScript<TFData, TFRelay, TFStore>(props);
    };

    /* Tell the ecosystem this is the root render */
    const root = () => {
        if (!active_engine) setActiveScriptEngine(new ScriptEngine());

        if (isAtomic) active_engine!.setAtomic(config.atomic!);
        if (mountPath) active_engine!.setMountPath(mountPath);
        active_engine!.setRoot(true);
    };

    /* Sets mount path for global script file collection */
    const setMountPath = (path: string | null) => {
        mountPath = typeof path === 'string' ? path : null;
    };

    return {
        Script,
        script: {
            env,
            state,
            nonce,
            root,
            isAtomic,
            setMountPath,
        },
    };
}
