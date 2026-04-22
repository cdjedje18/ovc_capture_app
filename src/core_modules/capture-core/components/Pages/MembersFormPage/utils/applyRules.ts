export function applyEffectsToHeaders(headers: any, effects: any) {
    const hiddenProgramStages = Object.keys(effects.HIDEPROGRAMSTAGE || {});

    return headers?.map((header: any) => {
        const variable = { ...header };

        // 🔴 HIDEPROGRAMSTAGE (global por stage)
        if (hiddenProgramStages.includes(variable.programStageId)) {
            variable.disabled = true;
        }

        // HIDEFIELD
        if (effects.HIDEFIELD?.[variable.id]) {
            variable.disabled = true;
        }

        // SHOWERROR
        if (effects.SHOWERROR?.[variable.id]) {
            const errorEffects = effects.SHOWERROR[variable.id];
            errorEffects.forEach(effect => {
                variable.error = true;
                variable.content = effect.message;
            });
        }

        // SHOWWARNING
        if (effects.SHOWWARNING?.[variable.id]) {
            const warningEffects = effects.SHOWWARNING[variable.id];
            warningEffects.forEach(effect => {
                variable.warning = true;
                variable.content = effect.message;
            });
        }

        // SETMANDATORYFIELD
        if (effects.SETMANDATORYFIELD?.[variable.id]) {
            const mandatoryEffects = effects.SETMANDATORYFIELD[variable.id];
            mandatoryEffects.forEach(effect => {
                variable.required = !!effect.conditionMet;
            });
        }

        // ASSIGN
        if (effects.ASSIGN?.[variable.id]) {
            const assignEffects = effects.ASSIGN[variable.id];
            assignEffects.forEach(effect => {
                variable.value = effect.value;
                variable.disabled = true;
            });
        }

        return variable;
    });
}