import { useMemo } from 'react';
import type { WorkingListTemplate } from '../../../WorkingListsBase';

export const useStaticTemplates = (defaultAlteredTemplate: WorkingListTemplate | undefined, defaultTemplateId: string) =>
    useMemo(
        () => [
            defaultAlteredTemplate || {
                id: defaultTemplateId,
                isDefault: true,
                name: 'default',
                access: {
                    update: false,
                    delete: false,
                    write: false,
                    manage: false,
                },
            },
            // {
            //     id: 'active',
            //     name: i18n.t('Active enrollments'),
            //     order: 1,
            //     access: {
            //         update: false,
            //         delete: false,
            //         write: false,
            //         manage: false,
            //     },
            //     criteria: {
            //         programStatus: 'ACTIVE',
            //     },
            // },
            // {
            //     id: 'complete',
            //     name: i18n.t('Completed enrollments'),
            //     order: 2,
            //     access: {
            //         update: false,
            //         delete: false,
            //         write: false,
            //         manage: false,
            //     },
            //     criteria: {
            //         programStatus: 'COMPLETED',
            //     },
            // },
            // {
            //     id: 'cancelled',
            //     name: i18n.t('Cancelled enrollments'),
            //     order: 3,
            //     access: {
            //         update: false,
            //         delete: false,
            //         write: false,
            //         manage: false,
            //     },
            //     criteria: {
            //         programStatus: 'CANCELLED',
            //     },
            // },
        ],
        [defaultAlteredTemplate, defaultTemplateId],
    );
