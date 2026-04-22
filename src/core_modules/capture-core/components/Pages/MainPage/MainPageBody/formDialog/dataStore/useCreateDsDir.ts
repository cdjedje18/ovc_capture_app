import { useDataEngine, useDataMutation } from '@dhis2/app-runtime'
import { useGetFavorites } from './useGetFavorites';
import useShowAlerts from 'capture-core/components/Pages/MembersFormPage/hooks/common/useShowAlert';
import { useState } from 'react';

const mutationSaveTest: any = (path: string) => ({
    resource: `dataStore/ovc_capture_app`,
    data: () => [],
    type: 'create'
})

export function useCreateDsDir() {
    const { getTemplates } = useGetFavorites()
    const { hide, show } = useShowAlerts()
    const engine = useDataEngine()
    const [loading, setLoading] = useState(false)

    async function save(path: string) {
        setLoading(true)
        await engine.mutate(mutationSaveTest(path), {
            onComplete: (data) => {
                getTemplates()
            },
            onError: (error) => {
                show({
                    message: `Ocorreu um erro inesperado`,
                    type: { critical: true }
                });
                setTimeout(hide, 5000);
            }
        })
    }

    const createDir = async (path: string) => {
        await save(path)
    }

    return { createDir, loading }
}