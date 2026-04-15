import { Button, IconArrowLeft16, SelectorBar } from '@dhis2/ui';
import { ProgramSelector } from './Program/ProgramSelector.component';
import { OrgUnitSelector } from './OrgUnitSelector.component';
import type { Props } from './QuickSelector.types';
import { isMembersFormPage as isMembersFormPageRoute } from '../../WorkingLists/utils/isMembersFormPage';
import { useNavigate } from 'capture-core/utils/routing';

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
    const { navigate } = useNavigate()

    return (
        <SelectorBar
            disableClearSelections={isMembersFormPage || (!selectedProgramId && !selectedOrgUnitId)}
            onClearSelectionClick={!isMembersFormPage ? () => onStartAgain() : undefined}
            additionalContent={
                isMembersFormPage ? <div style={{ margin: "5px" }} >
                    <Button icon={<IconArrowLeft16/>} small onClick={() => navigate('-1')} >Voltar</Button>
                </div> : <></>
            }
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
