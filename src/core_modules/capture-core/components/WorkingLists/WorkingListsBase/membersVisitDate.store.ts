import { useSyncExternalStore } from 'react';

let state: string | undefined;
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

export const setSelectedMembersVisitDate = (date: string | undefined) => {
    if (state === date) {
        return;
    }

    state = date;
    emit();
};

export const useSelectedMembersVisitDate = () =>
    useSyncExternalStore(
        subscribe,
        () => state,
        () => undefined,
    );

