import { useDataEngine } from '@dhis2/app-runtime';
import { useQuery } from '@tanstack/react-query';

export const useUserLocale = (): {
    locale: any;
    isSuperuser: boolean;
    isLoading: boolean;
    isError: boolean;
    error: unknown;
} => {
    const dataEngine = useDataEngine();

    const { data, isInitialLoading, isError, error } = useQuery(
        ['userLocale'],
        () => dataEngine.query({
            userSettings: {
                resource: 'me',
                params: {
                    fields: 'settings[keyUiLocale],userRoles[*]',
                },
            },
        }));

    return {
        locale: (data as any)?.userSettings?.settings?.keyUiLocale,
        isSuperuser: (data as any)?.userSettings?.userRoles?.some(x => x?.code?.toLowerCase() === 'superuser') ?? false,
        isLoading: isInitialLoading,
        isError,
        error,
    };
};
