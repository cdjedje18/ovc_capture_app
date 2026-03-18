import { useMemo } from 'react';
import { featureAvailable, FEATURES } from 'capture-core-utils';
import i18n from '@dhis2/d2-i18n';
import { dataElementTypes, type TrackerProgram } from '../../../../../metaData';
import { MAIN_FILTERS } from '../../constants';

export const useFiltersOnly = (
    { enrollment: { incidentDateLabel, showIncidentDate }, stages }: TrackerProgram,
    programStageId?: string,
) =>
    useMemo(() => {
        const enableUserAssignment =
            !programStageId && Array.from(stages.values()).find((stage: any) => stage.enableUserAssignment);
        return [
            ...(showIncidentDate
                ? [
                    {
                        id: MAIN_FILTERS.OCCURED_AT,
                        type: dataElementTypes.DATE,
                        header: incidentDateLabel,
                        transformRecordsFilter: (filter: string) => {
                            const queryArgs: any = {};
                            const filterParts = filter.split(':');
                            const indexGe = filterParts.indexOf('ge');
                            const indexLe = filterParts.indexOf('le');
                            if (indexGe !== -1 && filterParts[indexGe + 1]) {
                                queryArgs.enrollmentOccurredAfter = filterParts[indexGe + 1];
                            }
                            if (indexLe !== -1 && filterParts[indexLe + 1]) {
                                queryArgs.enrollmentOccurredBefore = filterParts[indexLe + 1];
                            }
                            return queryArgs;
                        },
                    },
                ]
                : []),
            {
                id: MAIN_FILTERS.FOLLOW_UP,
                type: dataElementTypes.BOOLEAN,
                header: i18n.t('Follow up'),
                showInMoreFilters: true,
                multiValueFilter: false,
                transformRecordsFilter: (rawFilter: string) => ({
                    followUp: rawFilter.split(':')[1],
                }),
            },
            ...(enableUserAssignment
                ? [
                    {
                        id: MAIN_FILTERS.ASSIGNEE,
                        type: dataElementTypes.ASSIGNEE,
                        header: i18n.t('Assigned to'),
                        transformRecordsFilter: (rawFilter: any) => {
                            const { assignedUserMode } = rawFilter;
                            const assignedUsersQueryParam: string = featureAvailable(FEATURES.newEntityFilterQueryParam)
                                ? 'assignedUsers'
                                : 'assignedUser';
                            const assignedUser = rawFilter[assignedUsersQueryParam];
                            return {
                                assignedUserMode,
                                ...(assignedUser && { [assignedUsersQueryParam]: assignedUser }),
                            };
                        },
                    },
                ]
                : []),
        ];
    }, [incidentDateLabel, showIncidentDate, stages, programStageId]);
