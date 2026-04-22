import { useEffect, useState } from 'react';
import {
    Modal, ModalTitle, ModalContent, ModalActions, Button, ButtonStrip, SingleSelect, SingleSelectOption
} from '@dhis2/ui';
import { programCollection } from 'capture-core/metaDataMemoryStores';
import { useTEIRelationshipsWidgetMetadata } from 'capture-core/components/Pages/common/TEIRelationshipsWidget';
import useShowAlerts from 'capture-core/components/Pages/MembersFormPage/hooks/common/useShowAlert';
import { useCreateDsTemplate } from './dataStore/useCreateDsTemplate';

export default function ConfigurationModal({ setOpen, open, data }: { setOpen: (open: boolean) => void, open: boolean, data: any }) {
    const programs = Array.from(programCollection.values()) as any;
    const [formData, setFormData] = useState<any>({
        masterProgram: '',
        masterProgramName: "",
        dataEntryProgram: "",
        dataEntryProgramStage: "",
        relationshipType: "",
        nomeDoMembro: ""
    })
    const { relationshipTypes } = useTEIRelationshipsWidgetMetadata();
    const { hide, show } = useShowAlerts()
    const { postDsTemplate,loading } = useCreateDsTemplate()

    useEffect(() => {
        if (data?.length > 0) {
            const dataEntry = data?.find(x => x.key == 'data_entry')?.value?.programs?.[0]
            const programs = data?.find(x => x.key == 'programs')?.value?.masterPrograms?.[0]

            setFormData({
                masterProgram: programs?.id,
                masterProgramName: programs?.name,
                dataEntryProgram: dataEntry?.program,
                dataEntryProgramStage: dataEntry?.programStage,
                relationshipType: programs?.relationshipType,
                nomeDoMembro: dataEntry?.nomeDoMembro
            })
        }
    }, [data])

    const save = async () => {
        if (Object.values(formData).some(x => !x)) {
            show({
                message: `Preencha todos os campos`,
                type: { warning: true }
            });
            setTimeout(hide, 5000);
            return
        } else {
            await postDsTemplate(formData)
        }
    }

    return (
        <>
            {open && (
                <Modal
                    position="middle"
                    large
                    onClose={() => setOpen(false)}
                >
                    <ModalTitle>Configurações</ModalTitle>

                    <ModalContent>
                        <div style={{ display: "grid", gridTemplateColumns: "40% 60%", marginBottom: "10px" }} >
                            <span style={{ fontSize: "15px", marginTop: "10px" }} >
                                Programa principal
                            </span>
                            <SingleSelect
                                clearable
                                className="select"
                                selected={formData.masterProgram}
                                onChange={(e) => {
                                    setFormData(prev => ({
                                        ...prev,
                                        masterProgram: e.selected,
                                        masterProgramName: programs?.find(x => x.id === e.selected)?.name
                                    }))
                                }}
                            >
                                {
                                    programs?.filter(x => x.id != formData.dataEntryProgram).map((p) => {
                                        return <SingleSelectOption
                                            label={p.name}
                                            value={p.id}
                                        />
                                    })
                                }
                            </SingleSelect>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "40% 60%", marginBottom: "10px" }} >
                            <span style={{ fontSize: "15px", marginTop: "10px" }} >
                                Programa de entrada de dados
                            </span>
                            <SingleSelect
                                className="select"
                                clearable
                                selected={formData.dataEntryProgram}
                                onChange={(e) => {
                                    setFormData(prev => ({ ...prev, dataEntryProgram: e.selected, dataEntryProgramStage: "" }))
                                }}
                            >
                                {
                                    programs?.filter(x => x.id != formData.masterProgram).map((p) => {
                                        return <SingleSelectOption
                                            label={p.name}
                                            value={p.id}
                                        />
                                    })
                                }
                            </SingleSelect>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "40% 60%", marginBottom: "10px" }} >

                            <span style={{ fontSize: "15px", marginTop: "10px" }} >
                                Estágio de entrada de dados
                            </span>
                            <SingleSelect
                                clearable
                                className="select"
                                selected={formData.dataEntryProgramStage}
                                onChange={(e) => {
                                    setFormData(prev => ({ ...prev, dataEntryProgramStage: e.selected }))
                                }}
                            >
                                {Array.from(
                                    programs
                                        ?.find(x => x.id === formData.dataEntryProgram)
                                        ?._stages
                                        ?.values() || []
                                ).map((stage: any) => (
                                    <SingleSelectOption
                                        key={stage.id}
                                        label={stage.name}
                                        value={stage.id}
                                    />
                                ))}
                            </SingleSelect>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "40% 60%", marginBottom: "10px" }} >

                            <span style={{ fontSize: "15px", marginTop: "10px" }} >
                                Relationship Type
                            </span>
                            <SingleSelect
                                clearable
                                className="select"
                                selected={formData.relationshipType}
                                onChange={(e) => {
                                    setFormData(prev => ({ ...prev, relationshipType: e.selected }))
                                }}
                            >
                                {relationshipTypes?.map((stage: any) => (
                                    <SingleSelectOption
                                        key={stage.id}
                                        label={stage.displayName}
                                        value={stage.id}
                                    />
                                ))}
                            </SingleSelect>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "40% 60%", marginBottom: "10px" }} >

                            <span style={{ fontSize: "15px", marginTop: "10px" }} >
                                Nome do membro
                            </span>
                            <SingleSelect
                                clearable
                                className="select"
                                selected={formData.nomeDoMembro}
                                onChange={(e) => {
                                    setFormData(prev => ({ ...prev, nomeDoMembro: e.selected }))
                                }}
                            >
                                {Array.from(
                                    programs
                                        ?.find(x => x.id === formData.dataEntryProgram)
                                        ?._attributes
                                        ?.values() || []
                                ).map((stage: any) => (
                                    <SingleSelectOption
                                        key={stage.id}
                                        label={stage.name}
                                        value={stage.id}
                                    />
                                ))}
                            </SingleSelect>
                        </div>
                    </ModalContent>

                    <ModalActions>
                        <ButtonStrip end>
                            <Button onClick={() => setOpen(false)}>
                                Cancel
                            </Button>
                            <Button loading={loading} primary onClick={() => save()} >
                                Salvar
                            </Button>
                        </ButtonStrip>
                    </ModalActions>
                </Modal>
            )}
        </>
    );
}