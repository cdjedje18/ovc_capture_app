import { useSyncExternalStore } from 'react';

type SelectionState = Record<string, string | undefined>;

let state: SelectionState = {};
const listeners = new Set<() => void>();

const emit = () => {
    listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

export const setSelectedMembersSection = (programStageId: string | undefined, sectionId: string | undefined) => {
    if (!programStageId) {
        return;
    }

    if (state[programStageId] === sectionId) {
        return;
    }

    state = {
        ...state,
        [programStageId]: sectionId,
    };
    emit();
};

export const useSelectedMembersSection = (programStageId: string | undefined) =>
    useSyncExternalStore(
        subscribe,
        () => (programStageId ? state[programStageId] : undefined),
        () => undefined,
    );
