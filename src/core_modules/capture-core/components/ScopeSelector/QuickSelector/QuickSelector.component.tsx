import React from 'react';
import { SelectorBar } from '@dhis2/ui';
import { ProgramSelector } from './Program/ProgramSelector.component';
import { OrgUnitSelector } from './OrgUnitSelector.component';
import type { Props } from './QuickSelector.types';
import { isMembersFormPage as isMembersFormPageRoute } from '../../WorkingLists/utils/isMembersFormPage';

export const QuickSelector = ({
    selectedOrgUnitId,
    selectedProgramId,
    selectedCategories,
    selectedOrgUnit,
    previousOrgUnitId,
    onSetOrgUnit,
    onSetProgramId,
    onSetCategoryOption,
    onResetOrgUnitId,
    onResetProgramId,
    onResetCategoryOption,
    onResetAllCategoryOptions,
    formIsOpen,
    children,
    onStartAgain,
    isReadOnlyOrgUnit,
    orgUnitTooltip,
}: Props) => {
    const isMembersFormPage = isMembersFormPageRoute();

    return (
        <SelectorBar
            disableClearSelections={isMembersFormPage || (!selectedProgramId && !selectedOrgUnitId)}
            onClearSelectionClick={!isMembersFormPage ? () => onStartAgain() : undefined}
        >
            <ProgramSelector
                selectedProgramId={selectedProgramId}
                selectedOrgUnitId={selectedOrgUnitId}
                selectedCategories={selectedCategories}
                handleClickProgram={onSetProgramId}
                handleSetCatergoryCombo={onSetCategoryOption}
                handleResetCategorySelections={onResetAllCategoryOptions}
                buttonModeMaxLength={5}
                onResetProgramId={onResetProgramId}
                onResetCategoryOption={onResetCategoryOption}
                onResetOrgUnit={onResetOrgUnitId}
                formIsOpen={formIsOpen}
            />
            <OrgUnitSelector
                previousOrgUnitId={previousOrgUnitId}
                selectedOrgUnitId={selectedOrgUnitId}
                handleClickOrgUnit={onSetOrgUnit}
                selectedOrgUnit={selectedOrgUnit}
                onReset={onResetOrgUnitId}
                isReadOnly={isReadOnlyOrgUnit}
                tooltip={orgUnitTooltip}
            />
            {children}
        </SelectorBar>
    );
};
