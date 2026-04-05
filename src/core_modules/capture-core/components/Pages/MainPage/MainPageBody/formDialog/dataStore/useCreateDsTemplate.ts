import { useState } from 'react';
import { useDataEngine } from "@dhis2/app-runtime";
import useShowAlerts from 'capture-core/components/Pages/MembersFormPage/hooks/common/useShowAlert';

const DATASTOREQUERY: any = (path: string) => ({
    resource: "dataStore/ovc_capture_app/" + path,
    data: ({ data }: any) => data,
    type: 'update'
})

export const useCreateDsTemplate = () => {
    const engine = useDataEngine()
    const { hide, show } = useShowAlerts()
    const [loading, setloading] = useState(false)

    async function postDsTemplate(data: any): Promise<void> {
        setloading(true)
        const programs = {
            "programs": [
                {
                    "program": data?.dataEntryProgram,
                    "programStage": data?.dataEntryProgramStage
                }
            ]
        }

        const master = {
            "masterPrograms": [
                {
                    "id": data?.masterProgram,
                    "name": data?.masterProgramName,
                    "relationshipType": data?.relationshipType
                }
            ]
        }

        const values = [
            {
                key: 'data_entry',
                value: programs
            },
            {
                key: 'programs',
                value: master
            }
        ]

        for (let first of values) {
            const { key, value } = first

            await engine.mutate(DATASTOREQUERY(key), {
                variables: {
                    data: value
                },
                onComplete() {},
                onError(error) {
                    show({
                        message: `Ocorreu um erro inesperado`,
                        type: { critical: true }
                    });
                    setTimeout(hide, 5000);
                },
            });
        }
        window.location.reload()
    }

    async function createDsTemplate(data: any) {
        await postDsTemplate(data)
    }

    function editDsTemplate(data: any) {
        postDsTemplate(data)
    }

    return {
        createDsTemplate,
        editDsTemplate,
        postDsTemplate,
        loading
    }
}