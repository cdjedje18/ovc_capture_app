import React, { useCallback, useEffect, useMemo } from 'react';
import { useDataQuery } from '@dhis2/app-runtime';
// @ts-expect-error - SelectorBarItem is available at runtime, but its TypeScript definition is not exposed by the UI library
import { SelectorBarItem } from '@dhis2/ui';
import { FEATURES, featureAvailable } from 'capture-core-utils';
import { useDispatch } from 'react-redux';
import {
    ScopeSelector,
    useSetProgramId,
    useSetOrgUnitId,
    useResetProgramId,
    useResetOrgUnitId,
    useReset,
    setOrgUnitFromScopeSelector,
} from '../../../ScopeSelector';
import {
    setCategoryOption,
    resetCategoryOption,
    resetAllCategoryOptions,
} from '../shared/actions/mainPage.actions';
import type { TopBarProps } from './topBar.types';
import { useLocationQuery } from 'capture-core/utils/routing';

const FAMILY_NAME_ATTRIBUTE_ID = 'a8GQzSXuCH7';

const masterTeiQuery: any = {
    results: {
        resource: 'tracker/trackedEntities',
        params: ({ masterTeiId }) => ({
            [featureAvailable(FEATURES.newEntityFilterQueryParam) ? 'trackedEntities' : 'trackedEntity']: masterTeiId,
            fields: 'trackedEntity,attributes[attribute,value]',
            page: 1,
            pageSize: 1,
        }),
    },
};

export const TopBar = ({ programId, orgUnitId, selectedCategories }: TopBarProps) => {
    const dispatch = useDispatch();
    const { masterTEI } = useLocationQuery();
    const { setProgramId } = useSetProgramId();
    const { setOrgUnitId } = useSetOrgUnitId();
    const { resetProgramIdAndSelectedTemplateId } = useResetProgramId();
    const { resetOrgUnitId } = useResetOrgUnitId();
    const { reset } = useReset();
    const { data: masterTeiData, refetch: refetchMasterTei } = useDataQuery(masterTeiQuery, { lazy: true });

    const dispatchOnSetCategoryOption = useCallback(
        (categoryOption: Record<string, any>, categoryId: string) => {
            dispatch(setCategoryOption(categoryId, categoryOption));
        },
        [dispatch],
    );
    const dispatchOnResetCategoryOption = useCallback(
        (categoryId: string) => {
            dispatch(resetCategoryOption(categoryId));
        },
        [dispatch],
    );
    const dispatchOnResetAllCategoryOptions = useCallback(() => {
        dispatch(resetAllCategoryOptions());
    }, [dispatch]);

    const dispatchOnSetOrgUnit = useCallback(
        (id: string) => {
            setOrgUnitId(id);
            dispatch(setOrgUnitFromScopeSelector(id));
        },
        [dispatch, setOrgUnitId],
    );
    const selectedFamilyName = useMemo(() => {
        const masterTeiResults = masterTeiData?.results as any;
        const trackedEntity =
            masterTeiResults?.trackedEntities?.[0]
            || masterTeiResults?.instances?.[0];
        return trackedEntity?.attributes
            ?.find(({ attribute }) => attribute === FAMILY_NAME_ATTRIBUTE_ID)
            ?.value;
    }, [masterTeiData, masterTEI]);

    useEffect(() => {
        if (masterTEI) {
            refetchMasterTei({ masterTeiId: masterTEI });
        }
    }, [masterTEI, refetchMasterTei]);

    return (
        <ScopeSelector
            selectedProgramId={programId}
            selectedOrgUnitId={orgUnitId}
            selectedCategories={selectedCategories}
            onSetProgramId={id => setProgramId(id)}
            onSetOrgUnit={id => dispatchOnSetOrgUnit(id)}
            onResetProgramId={() => resetProgramIdAndSelectedTemplateId()}
            onResetOrgUnitId={() => resetOrgUnitId()}
            onSetCategoryOption={dispatchOnSetCategoryOption}
            onResetAllCategoryOptions={dispatchOnResetAllCategoryOptions}
            onResetCategoryOption={dispatchOnResetCategoryOption}
            onStartAgain={() => reset()}
        >
            <SelectorBarItem
                label="Familia"
                value={selectedFamilyName || ''}
                displayOnly
            />
        </ScopeSelector>
    );
};
