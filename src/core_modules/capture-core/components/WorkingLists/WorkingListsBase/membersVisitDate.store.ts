import { useSyncExternalStore } from 'react';

let state: string | undefined;
let availableDates: Array<string> = [];
let loadingSelectedDateEvents = false;
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

export const setAvailableMembersVisitDates = (dates: Array<string>) => {
    const uniqueSortedDates = Array.from(new Set(dates.filter(Boolean))).sort((a, b) => b.localeCompare(a));
    const didChange = availableDates.length !== uniqueSortedDates.length
        || availableDates.some((date, index) => date !== uniqueSortedDates[index]);

    if (!didChange) {
        return;
    }

    availableDates = uniqueSortedDates;
    emit();
};

export const setLoadingSelectedDateEvents = (loading: boolean) => {
    if (loadingSelectedDateEvents === loading) {
        return;
    }

    loadingSelectedDateEvents = loading;
    emit();
};

export const useSelectedMembersVisitDate = () =>
    useSyncExternalStore(
        subscribe,
        () => state,
        () => undefined,
    );

export const useAvailableMembersVisitDates = () =>
    useSyncExternalStore(
        subscribe,
        () => availableDates,
        () => [],
    );

export const useLoadingSelectedDateEvents = () =>
    useSyncExternalStore(
        subscribe,
        () => loadingSelectedDateEvents,
        () => false,
    );

