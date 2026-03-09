import type { MainViewConfig } from '../../../../../../WorkingLists/EventWorkingLists';

export type UseMainViewConfig = () => {
    mainViewConfig?: MainViewConfig;
    dataEntryPrograms?: Array<{ program: string; programStage: string }>;
    mainViewConfigReady: boolean;
};

export type DatastoreOccurredAt = {
    type: 'RELATIVE';
    period?: 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'THIS_YEAR' | 'LAST_WEEK' | 'LAST_MONTH' | 'LAST_3_MONTHS';
    startBuffer?: number;
    endBuffer?: number;
    lockedInAllViews?: boolean;
};

export type DatastoreWorkingListsEvents = {
    mainView: {
        occurredAt: DatastoreOccurredAt;
    };
};

export type DataStoreWorkingLists = {
    version: 1;
    global: {
        event: DatastoreWorkingListsEvents;
    };
};

export type DataStoreDataEntry = {
    programs?: Array<{
        program?: string;
        programStage?: string;
    }>;
};
